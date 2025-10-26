package pl.opyhl.oneoften.model;

public class ActiveQuestion {
    private String id;
    private String difficulty;
    private String category;
    private String question;
    private String answer;
    private int order;
    private boolean revealed;

    public ActiveQuestion() {}

    public ActiveQuestion(String id, String difficulty, String category, String question, String answer, int order, boolean revealed) {
        this.id = id;
        this.difficulty = difficulty;
        this.category = category;
        this.question = question;
        this.answer = answer;
        this.order = order;
        this.revealed = revealed;
    }

    public String getId(){ return id; }
    public void setId(String id){ this.id = id; }
    public String getDifficulty(){ return difficulty; }
    public void setDifficulty(String difficulty){ this.difficulty = difficulty; }
    public String getCategory(){ return category; }
    public void setCategory(String category){ this.category = category; }
    public String getQuestion(){ return question; }
    public void setQuestion(String question){ this.question = question; }
    public String getAnswer(){ return answer; }
    public void setAnswer(String answer){ this.answer = answer; }
    public int getOrder(){ return order; }
    public void setOrder(int order){ this.order = order; }
    public boolean isRevealed(){ return revealed; }
    public void setRevealed(boolean revealed){ this.revealed = revealed; }
}
