package pl.opyhl.oneoften.ws.dto;
public class JudgeDto {
    private int playerId;
    private boolean correct;
    public int getPlayerId(){ return playerId; }
    public void setPlayerId(int playerId){ this.playerId = playerId; }
    public boolean isCorrect(){ return correct; }
    public void setCorrect(boolean correct){ this.correct = correct; }
}
