package pl.opyhl.oneoften.service;

import org.springframework.stereotype.Service;
import pl.opyhl.oneoften.events.Event;
import pl.opyhl.oneoften.events.EventBus;
import pl.opyhl.oneoften.model.GamePhase;
import pl.opyhl.oneoften.model.GameState;
import pl.opyhl.oneoften.model.Player;
import pl.opyhl.oneoften.model.Player.Gender;

import java.io.BufferedWriter;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.text.SimpleDateFormat;
import java.util.*;

@Service
public class GameService {

    private final EventBus bus;
    private final RoundTimer timer;

    private final List<Player> players = new ArrayList<>();
    private Integer answeringId = null;
    private boolean startBuzzOpen = false;
    private GamePhase phase = GamePhase.IDLE;

    private boolean timerActive = false;
    private int timerRemainingMs = 0;
    private long readStartMs = 0L;

    private Integer currentChooserId = null;
    private Integer proposedTargetId = null;
    private final Set<Integer> bannedThisQuestion = new HashSet<>();

    public GameService(EventBus bus, RoundTimer timer) {
        this.bus = bus;
        this.timer = timer;
        freshPlayers();
        pushState();
    }

    /* ===== meta ===== */
    public synchronized void setName(int id, String name){ get(id).ifPresent(p -> p.setName(name)); pushState(); }
    public synchronized void setGender(int id, String gender){
        get(id).ifPresent(p -> p.setGender("FEMALE".equalsIgnoreCase(gender) ? Gender.FEMALE : Gender.MALE));
        pushState();
    }
    public synchronized void playCue(String cue){ bus.publish(new Event("CUE", null, cue, null)); }

    /* ===== manual ===== */
    public synchronized void setAnswering(int id){
        Player p = get(id).orElse(null); if (p == null || p.isEliminated()) return;
        stopTimer();
        answeringId = id;
        currentChooserId = null;
        beginReadingNewQuestion();
        bus.publish(new Event("ANSWERING_STARTED", id, null, null));
        bus.publish(new Event("PHASE", null, "READING", null));
    }

    /* ===== reset / nowa gra ===== */
    public synchronized void reset(){
        players.forEach(p -> { p.setLives(3); p.setScore(0); p.setEliminated(false); });
        answeringId = null; startBuzzOpen = false; stopTimer();
        phase = GamePhase.IDLE; currentChooserId = null; proposedTargetId = null;
        bannedThisQuestion.clear();
        pushState(); bus.publish(new Event("RESET", null, null, null));
    }
    public synchronized void newGame(){
        stopTimer(); players.clear(); freshPlayers();
        answeringId = null; startBuzzOpen = false;
        phase = GamePhase.IDLE; currentChooserId = null; proposedTargetId = null;
        bannedThisQuestion.clear();
        pushState(); bus.publish(new Event("NEW_GAME", null, null, null));
    }
    private void freshPlayers(){ for (int i=1;i<=10;i++) players.add(new Player(i,"Gracz "+i)); }

    /* ===== flow prowadzącego ===== */
    public synchronized void hostStartRound(){
        phase = GamePhase.INTRO;
        answeringId = null;
        pushState();
        bus.publish(new Event("CUE", null, "INTRO", null));
        bus.publish(new Event("PHASE", null, "INTRO", null));
    }

    public synchronized void hostNextQuestion(){
        if (phase == GamePhase.INTRO) return;
        beginReadingNewQuestion();
        bus.publish(new Event("CUE", null, "START_Q", null));
        bus.publish(new Event("PHASE", null, "READING", null));
    }

    public synchronized void introDone(){
        if (phase != GamePhase.INTRO) return;
        beginReadingNewQuestion();
        bus.publish(new Event("CUE", null, "START_Q", null));
        bus.publish(new Event("PHASE", null, "READING", null));
    }

    public synchronized void hostReadDone(){
        readStartMs = System.currentTimeMillis();
        if (answeringId != null){
            phase = GamePhase.ANSWERING;
            startAnswerTimer(10_000);
            pushState();
            bus.publish(new Event("PHASE", null, "ANSWERING", null));
        } else {
            phase = GamePhase.BUZZING;
            pushState();
            bus.publish(new Event("PHASE", null, "BUZZING", null));
            bus.publish(new Event("BUZZ_OPEN", null, null, null));
        }
    }

    /* ===== start gry (kto pierwszy) ===== */
    public synchronized void openBuzzersStart(){
        startBuzzOpen = true; pushState(); bus.publish(new Event("BUZZ_OPEN", null, null, null));
    }
    public synchronized void buzzStart(int id){
        if (!startBuzzOpen) return;
        if (get(id).map(Player::isEliminated).orElse(true)) return;
        startBuzzOpen=false; answeringId=id; currentChooserId=null;
        beginReadingNewQuestion();
        bus.publish(new Event("BUZZ_RESULT", id, null, null));
        bus.publish(new Event("PHASE", null, "READING", null));
    }

    /* ===== runda ===== */
    public synchronized void roundBuzz(int id){
        if (phase != GamePhase.BUZZING || answeringId != null) return;
        if (bannedThisQuestion.contains(id)){
            bus.publish(new Event("BUZZ_BLOCKED", id, null, null));
            return;
        }
        Player p = get(id).orElse(null); if (p==null || p.isEliminated()) return;
        answeringId = id; long reaction = System.currentTimeMillis()-readStartMs;
        phase = GamePhase.ANSWERING;
        startAnswerTimer(10_000);
        pushState();
        bus.publish(new Event("ROUND_WINNER", id, null, reaction));
    }

    public synchronized void judge(int id, boolean correct){
        Optional<Player> opt = get(id); if (opt.isEmpty()) return;
        Player p = opt.get();
        stopTimer();

        if (correct){
            p.setScore(p.getScore()+1);
            currentChooserId = id;
            proposedTargetId = null;
            phase = GamePhase.SELECTING;
            pushState();
            bus.publish(new Event("JUDGE", id, "CORRECT", null));
            bus.publish(new Event("SELECT_START", id, null, null));
            bus.publish(new Event("CUE", null, "BOOM", null));
        } else {
            applyWrongFor(id);
        }
    }

    /* ===== wybór przeciwnika ===== */
    public synchronized void proposeTarget(int fromId, int toId){
        if (phase != GamePhase.SELECTING || !Objects.equals(currentChooserId, fromId)) return;
        Player t = get(toId).orElse(null);
        if (t==null || t.isEliminated()) return;
        proposedTargetId = toId;
        bus.publish(new Event("TARGET_PROPOSED", fromId, String.valueOf(toId), null));
    }

    public synchronized void approveTarget(boolean accept){
        if (phase != GamePhase.SELECTING || currentChooserId == null) return;

        if (proposedTargetId == null){
            bus.publish(new Event("TARGET_REJECTED", null, String.valueOf(currentChooserId), null));
            return;
        }

        if (accept){
            answeringId = proposedTargetId;
            int chooser = currentChooserId;
            proposedTargetId = null;
            beginReadingNewQuestion(); // nowe pytanie => czyścimy bany
            bus.publish(new Event("TARGET_ACCEPTED", answeringId, String.valueOf(chooser), null));
            bus.publish(new Event("CUE", null, "BOOM", null));
            bus.publish(new Event("LOCK_NEXT", null, "ON", null));
        } else {
            proposedTargetId = null;
            bus.publish(new Event("TARGET_REJECTED", null, String.valueOf(currentChooserId), null));
        }
    }

    public synchronized void boomDone(){
        bus.publish(new Event("BOOM_DONE", null, null, null));
        bus.publish(new Event("LOCK_NEXT", null, "OFF", null));
    }

    /* ===== timery ===== */
    private void startAnswerTimer(int totalMs){
        // twardy reset
        timer.stop();
        timerActive = true;
        timerRemainingMs = totalMs;

        // pierwszy tik od razu – front zobaczy 10.000 ms
        bus.timer(timerRemainingMs, true);

        timer.start(totalMs, (ms, active) -> {
            synchronized (GameService.this){
                timerRemainingMs = ms;
                timerActive = active;
                bus.timer(timerRemainingMs, timerActive);
                if (!active){
                    onAnswerTimeout();
                }
            }
        });
    }

    private void onAnswerTimeout(){
        // absolutny bezpiecznik – zatrzymaj zanim przełączysz logikę
        stopTimer();

        Integer id = answeringId;
        if (id == null){
            // Awaryjnie: nie trzymaj gry w martwym stanie
            phase = GamePhase.BUZZING;
            pushState();
            bus.publish(new Event("PHASE", null, "BUZZING", null));
            bus.publish(new Event("BUZZ_OPEN", null, null, null));
            return;
        }

        // Ujednolicenie z "Zła": front dostaje JUDGE:WRONG, potem cooldown/selecting
        bus.publish(new Event("TIMER_END", id, null, null));
        applyWrongFor(id);
    }

    private void applyWrongFor(int id){
        Player p = get(id).orElse(null); if (p == null) return;

        if (p.getLives() > 0) p.setLives(p.getLives()-1);
        if (p.getLives() <= 0) p.setEliminated(true);

        bus.publish(new Event("JUDGE", id, "WRONG", null));

        if (currentChooserId != null){
            if (Objects.equals(currentChooserId, id)) {
                // wybierający wziął na siebie i zawalił -> otwieramy ponownie buzzer po cooldownie
                bannedThisQuestion.add(id);
                bus.publish(new Event("BUZZ_BAN", id, null, null));
                currentChooserId = null;
                answeringId = null;
                startCooldown(3_000);
            } else {
                // wybrany zawalił -> ten sam wybierający wybiera dalej (nowe pytanie)
                answeringId = null;
                phase = GamePhase.SELECTING;
                pushState();
                bus.publish(new Event("SELECT_START", currentChooserId, null, null));
                bus.publish(new Event("CUE", null, "BOOM", null));
            }
        } else {
            // pytanie otwarte -> ban na to pytanie i cooldown
            bannedThisQuestion.add(id);
            bus.publish(new Event("BUZZ_BAN", id, null, null));
            startCooldown(3_000);
        }
    }

    private void startCooldown(int ms){
        // twardy reset
        timer.stop();
        timerActive = true;
        timerRemainingMs = ms;

        answeringId = null;              // w cooldownie nikt nie odpowiada
        phase = GamePhase.COOLDOWN;
        pushState();

        // kluczowe: natychmiast wyślij pierwszy tik 3.000 ms, żeby "3" nie wisiała bez tików
        bus.timer(timerRemainingMs, true);
        bus.publish(new Event("PHASE", null, "COOLDOWN", null));

        timer.start(ms, (left, active) -> {
            synchronized (GameService.this){
                timerRemainingMs = left;
                timerActive = active;
                bus.timer(timerRemainingMs, timerActive);
                if (!active){
                    // KONIEC COOLDOWNU → otwarte zgłaszanie
                    phase = GamePhase.BUZZING;
                    pushState();
                    bus.publish(new Event("PHASE", null, "BUZZING", null));
                    bus.publish(new Event("BUZZ_OPEN", null, null, null));
                }
            }
        });
    }

    private void stopTimer(){
        timer.stop();
        timerActive=false; timerRemainingMs=0;
        bus.timer(0,false);
    }

    private void beginReadingNewQuestion(){
        bannedThisQuestion.clear();
        phase = GamePhase.READING;
        pushState();
    }

    /* ===== zapis wyników ===== */
    public synchronized void saveResults(){
        try{
            Path dir = Paths.get("results"); Files.createDirectories(dir);
            String ts = new SimpleDateFormat("yyyyMMdd-HHmmss").format(new Date());
            Path file = dir.resolve("results-"+ts+".csv");
            try(BufferedWriter w = Files.newBufferedWriter(file, StandardCharsets.UTF_8)){
                w.write("id,name,gender,lives,score,eliminated\n");
                for (Player p: players){
                    w.write(p.getId()+","+safe(p.getName())+","+p.getGender()+","+p.getLives()+","+p.getScore()+","+p.isEliminated()+"\n");
                }
            }
            bus.publish(new Event("RESULTS_SAVED", null, file.toAbsolutePath().toString(), null));
        }catch(IOException e){
            bus.publish(new Event("RESULTS_SAVED", null, "ERROR:"+e.getMessage(), null));
        }
    }
    private String safe(String s){ return s==null? "" : s.replace(",", " ").replace("\n"," "); }

    /* ===== wspólne ===== */
    public synchronized GameState getState(){
        players.sort(Comparator.comparingInt(Player::getId));
        return new GameState(players, answeringId, startBuzzOpen, phase, timerActive, timerRemainingMs);
    }
    private Optional<Player> get(int id){ return players.stream().filter(p -> p.getId()==id).findFirst(); }
    private void pushState(){ bus.state(getState()); }
}
