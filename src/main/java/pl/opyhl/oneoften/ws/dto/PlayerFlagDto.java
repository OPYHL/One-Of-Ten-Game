package pl.opyhl.oneoften.ws.dto;

public class PlayerFlagDto {
    private int playerId;
    private boolean flag;

    public int getPlayerId(){ return playerId; }
    public void setPlayerId(int playerId){ this.playerId = playerId; }

    public boolean isFlag(){ return flag; }
    public void setFlag(boolean flag){ this.flag = flag; }
}
