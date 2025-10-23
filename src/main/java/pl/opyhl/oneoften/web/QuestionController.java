package pl.opyhl.oneoften.web;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import pl.opyhl.oneoften.model.question.QuestionCatalog;
import pl.opyhl.oneoften.model.question.QuestionDetail;
import pl.opyhl.oneoften.service.QuestionBank;

import java.util.Optional;

@RestController
@RequestMapping("/api/questions")
public class QuestionController {
    private final QuestionBank bank;

    public QuestionController(QuestionBank bank) {
        this.bank = bank;
    }

    @GetMapping
    public QuestionCatalog catalog(){
        return bank.getCatalog();
    }

    @GetMapping("/{difficulty}/{category}/{id}")
    public QuestionDetail detail(@PathVariable String difficulty,
                                 @PathVariable String category,
                                 @PathVariable String id){
        Optional<QuestionDetail> opt = bank.find(difficulty, category, id);
        return opt.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Question not found"));
    }
}
