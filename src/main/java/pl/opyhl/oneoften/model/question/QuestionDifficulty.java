package pl.opyhl.oneoften.model.question;

import java.util.List;

public class QuestionDifficulty {
    private final String id;
    private final String label;
    private final List<QuestionCategory> categories;

    public QuestionDifficulty(String id, String label, List<QuestionCategory> categories) {
        this.id = id;
        this.label = label;
        this.categories = categories;
    }

    public String getId(){ return id; }
    public String getLabel(){ return label; }
    public List<QuestionCategory> getCategories(){ return categories; }
}
