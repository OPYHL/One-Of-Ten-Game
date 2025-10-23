package pl.opyhl.oneoften.model.question;

import java.util.List;

public class QuestionCategory {
    private final String id;
    private final String label;
    private final List<QuestionSummary> questions;

    public QuestionCategory(String id, String label, List<QuestionSummary> questions) {
        this.id = id;
        this.label = label;
        this.questions = questions;
    }

    public String getId(){ return id; }
    public String getLabel(){ return label; }
    public List<QuestionSummary> getQuestions(){ return questions; }
}
