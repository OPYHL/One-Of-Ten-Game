package pl.opyhl.oneoften.model;

import java.util.List;

public class GameState {
    private List<Player> players;
    private Integer answeringId;
    private boolean startBuzzOpen;
    private GamePhase phase;
    private boolean timerActive;
    private int timerRemainingMs;
    private HostDashboard hostDashboard;
    private GameSettings settings;

    public GameState() {}
    public GameState(List<Player> players, Integer answeringId, boolean startBuzzOpen,
                     GamePhase phase, boolean timerActive, int timerRemainingMs, HostDashboard hostDashboard, GameSettings settings) {
        this.players = players;
        this.answeringId = answeringId;
        this.startBuzzOpen = startBuzzOpen;
        this.phase = phase;
        this.timerActive = timerActive;
        this.timerRemainingMs = timerRemainingMs;
        this.hostDashboard = hostDashboard;
        this.settings = settings;
    }

    public List<Player> getPlayers(){ return players; }
    public Integer getAnsweringId(){ return answeringId; }
    public boolean isStartBuzzOpen(){ return startBuzzOpen; }
    public GamePhase getPhase(){ return phase; }
    public boolean isTimerActive(){ return timerActive; }
    public int getTimerRemainingMs(){ return timerRemainingMs; }
    public HostDashboard getHostDashboard(){ return hostDashboard; }
    public GameSettings getSettings(){ return settings; }
}
