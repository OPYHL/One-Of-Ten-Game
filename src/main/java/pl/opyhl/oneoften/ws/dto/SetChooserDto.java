package pl.opyhl.oneoften.ws.dto;

public class SetChooserDto {
    private Integer playerId;
    private boolean notify = true;

    public Integer getPlayerId(){ return playerId; }
    public void setPlayerId(Integer playerId){ this.playerId = playerId; }

    public boolean isNotify(){ return notify; }
    public void setNotify(boolean notify){ this.notify = notify; }
}
