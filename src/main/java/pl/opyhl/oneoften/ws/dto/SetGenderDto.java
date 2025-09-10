package pl.opyhl.oneoften.ws.dto;
public class SetGenderDto {
    private int playerId;
    private String gender;
    public int getPlayerId(){ return playerId; }
    public void setPlayerId(int playerId){ this.playerId = playerId; }
    public String getGender(){ return gender; }
    public void setGender(String gender){ this.gender = gender; }
}
