package pl.opyhl.oneoften.service;

import org.springframework.stereotype.Service;
import pl.opyhl.oneoften.events.Event;
import pl.opyhl.oneoften.events.EventBus;
import pl.opyhl.oneoften.model.ActiveQuestion;
import pl.opyhl.oneoften.model.GamePhase;
import pl.opyhl.oneoften.model.GameSettings;
import pl.opyhl.oneoften.model.GameState;
import pl.opyhl.oneoften.model.HostDashboard;
import pl.opyhl.oneoften.model.HostMetrics;
import pl.opyhl.oneoften.model.Player;
import pl.opyhl.oneoften.model.Player.Gender;
import pl.opyhl.oneoften.model.config.HostConfig;
import pl.opyhl.oneoften.model.config.OperatorConfig;
import pl.opyhl.oneoften.model.config.TimerSlider;
import pl.opyhl.oneoften.model.question.QuestionDetail;

import java.io.BufferedWriter;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.text.SimpleDateFormat;
import java.util.*;

/**
 * Logika gry 1 z 10 – wersja „pancerna” na timeout:
 * - twarde stop/start timerów
 * - cooldown ma dodatkowego guarda (gdyby callback timera nie doszedł)
 * - timeout = jak „Zła” (ta sama ścieżka zdarzeń)
 */
@Service
public class GameService {

    private final EventBus bus;
    private final RoundTimer timer;
    private final QuestionBank questionBank;
    private final OperatorConfigService configService;
    private final QuestionUsageService questionUsageService;
    private final GameSettings settings;
    private final HostMetrics metrics = new HostMetrics();

    private ActiveQuestion activeQuestion = null;
    private long questionStartTimestamp = 0L;

    private final List<Player> players = new ArrayList<>();

    private Integer answeringId = null;
    private boolean startBuzzOpen = false;
    private GamePhase phase = GamePhase.IDLE;

    private boolean timerActive = false;
    private int timerRemainingMs = 0;

    /** Kto ma prawo wybierać po dobrej odpowiedzi. */
    private Integer currentChooserId = null;
    private Integer proposedTargetId = null;

    /** BAN w bieżącym pytaniu dla trybu „otwartego” (BUZZING). */
    private final Set<Integer> bannedThisQuestion = new HashSet<>();

    public GameService(EventBus bus, RoundTimer timer, QuestionBank questionBank, OperatorConfigService configService, QuestionUsageService questionUsageService) {
        this.bus = bus;
        this.timer = timer;
        this.questionBank = questionBank;
        this.configService = configService;
        this.questionUsageService = questionUsageService;

        OperatorConfig cfg = configService.getConfig();
        TimerSlider answer = (cfg != null) ? cfg.getAnswer() : null;
        TimerSlider cooldown = (cfg != null) ? cfg.getCooldown() : null;
        int answerDefault = (answer != null && answer.getDefaultSeconds() > 0) ? answer.getDefaultSeconds() : 10;
        int answerMin = (answer != null && answer.getMinSeconds() > 0) ? answer.getMinSeconds() : Math.max(1, answerDefault);
        int answerMax = (answer != null && answer.getMaxSeconds() > 0) ? answer.getMaxSeconds() : Math.max(answerMin, answerDefault);
        int answerStep = (answer != null && answer.getStepSeconds() > 0) ? answer.getStepSeconds() : 1;
        int cooldownDefault = (cooldown != null && cooldown.getDefaultSeconds() > 0) ? cooldown.getDefaultSeconds() : 3;
        settings = new GameSettings(
                Math.max(1, answerDefault) * 1000,
                Math.max(1, cooldownDefault) * 1000,
                Math.max(1, answerMin) * 1000,
                Math.max(Math.max(1, answerMin), answerMax) * 1000,
                Math.max(1, answerStep) * 1000
        );
        metrics.setStartedAt(System.currentTimeMillis());
        metrics.setAskedCount(0);
        metrics.setTotalQuestionTimeMs(0);
        metrics.setLastQuestionTimeMs(0);

        freshPlayers();
        pushState();
    }

    /* ================== metadane graczy ================== */
    public synchronized void setName(int id, String name){
        setName(id, name, false);
    }

    public synchronized void setName(int id, String name, boolean force){
        get(id).ifPresent(p -> {
            String trimmed = name == null ? "" : name.trim();
            if (trimmed.isEmpty()){
                p.setName("Gracz " + id);
                p.setJoined(false);
                return;
            }
            boolean placeholder = isPlaceholder(trimmed, id);
            String current = Optional.ofNullable(p.getName()).orElse("").trim();
            if (!force && p.isJoined() && !placeholder && !trimmed.equalsIgnoreCase(current)){
                bus.publish(new Event("JOIN_REJECTED", id, current, null));
                return;
            }
            p.setName(trimmed);
            p.setJoined(!placeholder);
        });
        pushState();
    }
    public synchronized void setGender(int id, String gender){
        get(id).ifPresent(p -> p.setGender("FEMALE".equalsIgnoreCase(gender) ? Gender.FEMALE : Gender.MALE));
        pushState();
    }
    public synchronized void selectQuestion(String difficulty, String category, String questionId){
        Optional<QuestionDetail> opt = questionBank.find(difficulty, category, questionId);
        if (opt.isEmpty()) return;
        QuestionDetail detail = opt.get();
        activeQuestion = new ActiveQuestion(detail.getId(), detail.getDifficulty(), detail.getCategory(), detail.getQuestion(), detail.getAnswer(), detail.getOrder(), false, true);
        questionStartTimestamp = 0L;
        pushState();
        bus.publish(new Event("QUESTION_SELECTED", null, detail.getId(), null));
        if (questionUsageService.markUsed(detail.getDifficulty(), detail.getCategory(), detail.getId())) {
            bus.publish(new Event("QUESTION_USAGE_MARKED", null, usageToken(detail.getDifficulty(), detail.getCategory(), detail.getId()), null));
        }
    }

    public synchronized void updateAnswerTimer(int seconds){
        if (seconds <= 0) return;
        int minSec = Math.max(1, settings.getAnswerMinMs() / 1000);
        int maxSec = Math.max(minSec, settings.getAnswerMaxMs() / 1000);
        int clamped = Math.min(maxSec, Math.max(minSec, seconds));
        settings.setAnswerTimerMs(clamped * 1000);
        pushState();
    }

    /* ============== operator/host ręcznie ============== */
    public synchronized void setAnswering(int id){
        Player p = get(id).orElse(null); if (p == null || p.isEliminated()) return;
        stopTimer();
        answeringId = id;
        currentChooserId = null;
        enterReadingSetup();               // nowe pytanie → czyścimy bany
        bus.publish(new Event("ANSWERING_STARTED", id, null, null));
        bus.publish(new Event("PHASE", null, "READING", null));
    }

    /* ================= reset / nowa gra ================= */
    public synchronized void reset(){
        players.forEach(p -> { p.setLives(3); p.setScore(0); p.setEliminated(false); });
        answeringId = null; startBuzzOpen = false;
        stopTimer();
        phase = GamePhase.IDLE; currentChooserId = null; proposedTargetId = null;
        bannedThisQuestion.clear();
        activeQuestion = null;
        questionStartTimestamp = 0L;
        metrics.setAskedCount(0);
        metrics.setTotalQuestionTimeMs(0);
        metrics.setLastQuestionTimeMs(0);
        metrics.setStartedAt(System.currentTimeMillis());
        pushState(); bus.publish(new Event("RESET", null, null, null));
    }

    public synchronized void newGame(){
        stopTimer();
        players.clear();
        freshPlayers();
        answeringId = null; startBuzzOpen = false;
        phase = GamePhase.IDLE; currentChooserId = null; proposedTargetId = null;
        bannedThisQuestion.clear();
        activeQuestion = null;
        questionStartTimestamp = 0L;
        metrics.setAskedCount(0);
        metrics.setTotalQuestionTimeMs(0);
        metrics.setLastQuestionTimeMs(0);
        metrics.setStartedAt(System.currentTimeMillis());
        pushState(); bus.publish(new Event("NEW_GAME", null, null, null));
    }

    private void freshPlayers(){
        for (int i=1; i<=10; i++){
            Player p = new Player(i, "Gracz " + i);
            p.setJoined(false);
            players.add(p);
        }
    }

    /* ================= flow prowadzącego ================= */
    public synchronized void hostStartRound(){
        phase = GamePhase.INTRO;
        answeringId = null;
        currentChooserId = null;
        proposedTargetId = null;
        activeQuestion = null;
        questionStartTimestamp = 0L;
        metrics.setStartedAt(System.currentTimeMillis());
        metrics.setAskedCount(0);
        metrics.setTotalQuestionTimeMs(0);
        metrics.setLastQuestionTimeMs(0);
        pushState();
        bus.publish(new Event("CUE", null, "INTRO", null));
        bus.publish(new Event("PHASE", null, "INTRO", null));
    }

    public synchronized void hostNextQuestion(){
        if (phase == GamePhase.INTRO) return;
        enterReadingSetup();
        bus.publish(new Event("PHASE", null, "READING", null));
    }

    public synchronized void introDone(){
        if (phase != GamePhase.INTRO) return;
        enterReadingSetup();
        bus.publish(new Event("PHASE", null, "READING", null));
    }

    public synchronized void hostReadDone(){
        revealCurrentQuestion();
        if (answeringId != null){
            phase = GamePhase.ANSWERING;
            startAnswerTimer(settings.getAnswerTimerMs());
            pushState();
            bus.publish(new Event("PHASE", null, "ANSWERING", null));
        } else {
            phase = GamePhase.BUZZING;
            pushState();
            bus.publish(new Event("PHASE", null, "BUZZING", null));
            bus.publish(new Event("BUZZ_OPEN", null, null, null));
        }
    }

    public synchronized void playCue(String cue){
        if (cue == null) return;
        String normalized = cue.trim();
        if (normalized.isEmpty()) return;
        String upper = normalized.toUpperCase(Locale.ROOT);
        switch (upper) {
            case "INTRO":
            case "START_Q":
            case "BOOM":
                bus.publish(new Event("CUE", null, upper, null));
                break;
            default:
                bus.publish(new Event("CUE", null, normalized, null));
                break;
        }
    }

    /* ========== start gry: pierwszy z buzzera ========== */
    public synchronized void openBuzzersStart(){
        startBuzzOpen = true; pushState(); bus.publish(new Event("BUZZ_OPEN", null, null, null));
    }
    public synchronized void buzzStart(int id){
        if (!startBuzzOpen) return;
        if (get(id).map(Player::isEliminated).orElse(true)) return;
        startBuzzOpen=false; answeringId=id; currentChooserId=null;
        enterReadingSetup();
        bus.publish(new Event("BUZZ_RESULT", id, null, null));
        bus.publish(new Event("PHASE", null, "READING", null));
    }

    /* =================== runda =================== */
    public synchronized void roundBuzz(int id){
        if (phase != GamePhase.BUZZING || answeringId != null) return;
        if (bannedThisQuestion.contains(id)){
            bus.publish(new Event("BUZZ_BLOCKED", id, null, null));
            return;
        }
        Player p = get(id).orElse(null); if (p==null || p.isEliminated()) return;
        answeringId = id;
        phase = GamePhase.ANSWERING;
        startAnswerTimer(settings.getAnswerTimerMs());
        pushState();
        bus.publish(new Event("ROUND_WINNER", id, null, null));
    }

    public synchronized void judge(int id, boolean correct){
        Optional<Player> opt = get(id); if (opt.isEmpty()) return;
        Player p = opt.get();
        stopTimer();

        if (correct){
            p.setScore(p.getScore()+1);
            currentChooserId = id;
            proposedTargetId = null;
            registerQuestionFinished();
            phase = GamePhase.SELECTING;
            pushState();
            bus.publish(new Event("JUDGE", id, "CORRECT", null));
            bus.publish(new Event("SELECT_START", id, null, null));
            bus.publish(new Event("CUE", null, "BOOM", null));
        } else {
            applyWrongFor(id);
        }
    }

    /* ============== wybór przeciwnika ============== */
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
            boolean selfTarget = Objects.equals(answeringId, chooser);
            if (selfTarget){
                currentChooserId = null;
            }
            proposedTargetId = null;
            enterReadingSetup();          // nowe pytanie -> czyść bany
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

    /* =================== timery =================== */
    private void registerQuestionFinished(){
        if (questionStartTimestamp > 0){
            long duration = Math.max(0, System.currentTimeMillis() - questionStartTimestamp);
            metrics.setAskedCount(metrics.getAskedCount() + 1);
            metrics.setTotalQuestionTimeMs(metrics.getTotalQuestionTimeMs() + duration);
            metrics.setLastQuestionTimeMs(duration);
            questionStartTimestamp = 0L;
        }
        activeQuestion = null;
    }

    private void revealCurrentQuestion(){
        if (activeQuestion != null && !activeQuestion.isRevealed()){
            activeQuestion.setPreparing(false);
            activeQuestion.setRevealed(true);
            bus.publish(new Event("QUESTION_REVEALED", null, activeQuestion.getId(), null));
        }
    }

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

        // Ujednolicenie z „Zła”: front dostaje JUDGE:WRONG, potem cooldown/selecting
        bus.publish(new Event("TIMER_END", id, null, null));
        applyWrongFor(id);
    }

    private void stopTimer(){
        timer.stop();
        timerActive = false;
        timerRemainingMs = 0;
    }

    /* =================== helpers =================== */
    private void enterReadingSetup(){
        bannedThisQuestion.clear();
        phase = GamePhase.READING;
        questionStartTimestamp = 0L;
        if (activeQuestion != null){
            activeQuestion.setRevealed(false);
            activeQuestion.setPreparing(true);
        }
        pushState();
    }

    public synchronized void hostReadingStart(){
        if (phase != GamePhase.READING) return;
        if (activeQuestion == null) return;
        if (!activeQuestion.isPreparing()) return;
        activeQuestion.setPreparing(false);
        questionStartTimestamp = System.currentTimeMillis();
        pushState();
        bus.publish(new Event("CUE", null, "START_Q", null));
        bus.publish(new Event("PHASE", null, "READING", null));
    }

    /** Zła odpowiedź / timeout. */
    private void applyWrongFor(int id){
        Player p = get(id).orElse(null); if (p == null) return;

        registerQuestionFinished();

        // Punktacja/życia
        int lives = Math.max(0, p.getLives() - 1);
        p.setLives(lives);
        if (lives <= 0) p.setEliminated(true);

        bus.publish(new Event("JUDGE", id, "WRONG", null));
        pushState();

        if (currentChooserId != null){
            // Tryb: wybrany przez zwycięzcę – wracamy do wybierania
            answeringId = null;
            phase = GamePhase.SELECTING;
            pushState();
            bus.publish(new Event("SELECT_START", currentChooserId, null, null));
            bus.publish(new Event("CUE", null, "BOOM", null));
        } else {
            // Tryb: otwarte zgłaszanie – natychmiast przygotuj kolejne pytanie
            answeringId = null;
            proposedTargetId = null;
            enterReadingSetup();
            bus.publish(new Event("PHASE", null, "READING", null));
        }
    }

    /** Zapis wyników do CSV + event dla frontu (RESULTS_SAVED). */
    public synchronized void saveResults(){
        try{
            Path dir = Paths.get("results");
            Files.createDirectories(dir);
            String ts = new SimpleDateFormat("yyyyMMdd-HHmmss").format(new Date());
            Path file = dir.resolve("results-" + ts + ".csv");

            try (BufferedWriter w = Files.newBufferedWriter(file, StandardCharsets.UTF_8)){
                w.write("id,name,gender,lives,score,eliminated\n");
                for (Player p : players){
                    w.write(p.getId() + "," +
                            csvCell(p.getName()) + "," +
                            p.getGender() + "," +
                            p.getLives() + "," +
                            p.getScore() + "," +
                            p.isEliminated() + "\n");
                }
            }

            // powiadomienie dla UI (host/operator), np. do toasta
            bus.publish(new Event("RESULTS_SAVED", null, file.toAbsolutePath().toString(), null));

        } catch (IOException e){
            bus.publish(new Event("RESULTS_SAVED", null, "ERROR:" + e.getMessage(), null));
        }
    }

    /** Prosty escape do CSV (cudzysłowy + przecinki). */
    private String csvCell(String s){
        if (s == null) return "";
        String v = s.replace("\"", "\"\"");
        if (v.contains(",") || v.contains("\"")) return "\"" + v + "\"";
        return v;
    }


    public synchronized GameState getState(){
        players.sort(Comparator.comparingInt(Player::getId));
        return new GameState(players, answeringId, startBuzzOpen, phase, timerActive, timerRemainingMs, buildHostDashboard(), settings);
    }

    private HostDashboard buildHostDashboard(){
        ActiveQuestion aq = null;
        if (activeQuestion != null){
            aq = new ActiveQuestion(
                    activeQuestion.getId(),
                    activeQuestion.getDifficulty(),
                    activeQuestion.getCategory(),
                    activeQuestion.getQuestion(),
                    activeQuestion.getAnswer(),
                    activeQuestion.getOrder(),
                    activeQuestion.isRevealed(),
                    activeQuestion.isPreparing()
            );
        }
        HostMetrics m = new HostMetrics(metrics.getStartedAt(), metrics.getAskedCount(), metrics.getTotalQuestionTimeMs(), metrics.getLastQuestionTimeMs());
        HostConfig hostCfg = configService.getConfig() != null ? configService.getConfig().getHost() : null;
        String hostName = hostCfg != null && hostCfg.getName() != null ? hostCfg.getName() : "Prowadzący";
        String welcomeTitle = hostCfg != null && hostCfg.getWelcomeTitle() != null ? hostCfg.getWelcomeTitle() : "Witaj!";
        String welcomeSub = hostCfg != null && hostCfg.getWelcomeSubtitle() != null ? hostCfg.getWelcomeSubtitle() : "Przygotuj się do gry.";
        return new HostDashboard(aq, m, hostName, welcomeTitle, welcomeSub);
    }

    private boolean isPlaceholder(String value, int id){
        if (value == null) return true;
        String trimmed = value.trim();
        if (trimmed.isEmpty()) return true;
        return trimmed.equalsIgnoreCase("Gracz " + id);
    }

    private Optional<Player> get(int id){ return players.stream().filter(p -> p.getId()==id).findFirst(); }
    private void pushState(){ bus.state(getState()); }

    private String usageToken(String difficulty, String category, String questionId) {
        return String.join("::",
                difficulty != null ? difficulty : "",
                category != null ? category : "",
                questionId != null ? questionId : "");
    }
}
