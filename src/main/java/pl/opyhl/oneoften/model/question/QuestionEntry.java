package pl.opyhl.oneoften.model.question;

public class QuestionEntry {
    private String id;
    private String question;
    private String answer;
    private String annotation;

    private String difficulty;
    private String category;
    private int order;

    public QuestionEntry() {}

    public String getId(){ return id; }
    public void setId(String id){ this.id = id; }

    public String getQuestion(){ return question; }
    public void setQuestion(String question){ this.question = question; }

    public String getAnswer(){ return answer; }
    public void setAnswer(String answer){ this.answer = answer; }

    public String getAnnotation(){ return annotation; }
    public void setAnnotation(String annotation){ this.annotation = annotation; }

    public String getDifficulty(){ return difficulty; }
    public void setDifficulty(String difficulty){ this.difficulty = difficulty; }

    public String getCategory(){ return category; }
    public void setCategory(String category){ this.category = category; }

    public int getOrder(){ return order; }
    public void setOrder(int order){ this.order = order; }
}
