package pl.opyhl.oneoften.ws.dto;

public class SetAvatarDto {
    private int playerId;
    private String avatar;

    public int getPlayerId(){ return playerId; }
    public void setPlayerId(int playerId){ this.playerId = playerId; }

    public String getAvatar(){ return avatar; }
    public void setAvatar(String avatar){ this.avatar = avatar; }
}
