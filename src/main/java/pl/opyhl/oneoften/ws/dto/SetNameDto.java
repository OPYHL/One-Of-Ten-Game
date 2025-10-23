package pl.opyhl.oneoften.ws.dto;
public class SetNameDto {
    private int playerId;
    private String name;
    private boolean force;
    public int getPlayerId(){ return playerId; }
    public void setPlayerId(int playerId){ this.playerId = playerId; }
    public String getName(){ return name; }
    public void setName(String name){ this.name = name; }
    public boolean isForce(){ return force; }
    public void setForce(boolean force){ this.force = force; }
}
