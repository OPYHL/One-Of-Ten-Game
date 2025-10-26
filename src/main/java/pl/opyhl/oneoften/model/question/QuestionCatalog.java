package pl.opyhl.oneoften.model.question;

import java.util.List;

public class QuestionCatalog {
    private final List<QuestionDifficulty> difficulties;

    public QuestionCatalog(List<QuestionDifficulty> difficulties) {
        this.difficulties = difficulties;
    }

    public List<QuestionDifficulty> getDifficulties(){ return difficulties; }
}
