package pl.opyhl.oneoften.events;

public class Event {
    private String type;        // np. TARGET_PROPOSED / TARGET_ACCEPTED / SELECT_START / JUDGE ...
    private Integer playerId;   // kontekst (kto dotyczy)
    private String value;       // dodatkowa wartość (np. toId albo fromId jako String)
    private Long reactionMs;    // opcjonalnie czas reakcji w ms

    public Event() {}
    public Event(String type, Integer playerId, String value, Long reactionMs) {
        this.type = type;
        this.playerId = playerId;
        this.value = value;
        this.reactionMs = reactionMs;
    }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public Integer getPlayerId() { return playerId; }
    public void setPlayerId(Integer playerId) { this.playerId = playerId; }
    public String getValue() { return value; }
    public void setValue(String value) { this.value = value; }
    public Long getReactionMs() { return reactionMs; }
    public void setReactionMs(Long reactionMs) { this.reactionMs = reactionMs; }
}
