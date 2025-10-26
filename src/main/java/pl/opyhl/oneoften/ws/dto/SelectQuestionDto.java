package pl.opyhl.oneoften.ws.dto;

public class SelectQuestionDto {
    private String difficulty;
    private String category;
    private String questionId;

    public String getDifficulty(){ return difficulty; }
    public void setDifficulty(String difficulty){ this.difficulty = difficulty; }

    public String getCategory(){ return category; }
    public void setCategory(String category){ this.category = category; }

    public String getQuestionId(){ return questionId; }
    public void setQuestionId(String questionId){ this.questionId = questionId; }
}
