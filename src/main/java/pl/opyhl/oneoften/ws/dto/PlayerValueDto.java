package pl.opyhl.oneoften.ws.dto;

public class PlayerValueDto {
    private int playerId;
    private int value;

    public int getPlayerId(){ return playerId; }
    public void setPlayerId(int playerId){ this.playerId = playerId; }

    public int getValue(){ return value; }
    public void setValue(int value){ this.value = value; }
}
