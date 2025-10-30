package pl.opyhl.oneoften.ws.dto;

public class ManualEventDto {
    private String type;
    private Integer playerId;
    private String value;
    private Long reactionMs;

    public String getType(){ return type; }
    public void setType(String type){ this.type = type; }

    public Integer getPlayerId(){ return playerId; }
    public void setPlayerId(Integer playerId){ this.playerId = playerId; }

    public String getValue(){ return value; }
    public void setValue(String value){ this.value = value; }

    public Long getReactionMs(){ return reactionMs; }
    public void setReactionMs(Long reactionMs){ this.reactionMs = reactionMs; }
}
