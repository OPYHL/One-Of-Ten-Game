package pl.opyhl.oneoften.ws.dto;
public class SetNameDto {
    private int playerId;
    private String name;
    public int getPlayerId(){ return playerId; }
    public void setPlayerId(int playerId){ this.playerId = playerId; }
    public String getName(){ return name; }
    public void setName(String name){ this.name = name; }
}
