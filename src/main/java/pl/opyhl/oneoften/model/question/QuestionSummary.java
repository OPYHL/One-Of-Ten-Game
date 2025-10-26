package pl.opyhl.oneoften.model.question;

public class QuestionSummary {
    private final String id;
    private final String display;
    private final int order;

    public QuestionSummary(String id, String display, int order) {
        this.id = id;
        this.display = display;
        this.order = order;
    }

    public String getId(){ return id; }
    public String getDisplay(){ return display; }
    public int getOrder(){ return order; }
}
