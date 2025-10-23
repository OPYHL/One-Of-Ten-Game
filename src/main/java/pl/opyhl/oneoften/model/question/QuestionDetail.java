package pl.opyhl.oneoften.model.question;

public class QuestionDetail {
    private final String id;
    private final String difficulty;
    private final String category;
    private final String question;
    private final String answer;
    private final int order;

    public QuestionDetail(String id, String difficulty, String category, String question, String answer, int order) {
        this.id = id;
        this.difficulty = difficulty;
        this.category = category;
        this.question = question;
        this.answer = answer;
        this.order = order;
    }

    public String getId(){ return id; }
    public String getDifficulty(){ return difficulty; }
    public String getCategory(){ return category; }
    public String getQuestion(){ return question; }
    public String getAnswer(){ return answer; }
    public int getOrder(){ return order; }
}
