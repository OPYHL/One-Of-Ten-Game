package pl.opyhl.oneoften.web;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pl.opyhl.oneoften.events.Event;
import pl.opyhl.oneoften.events.EventBus;
import pl.opyhl.oneoften.model.question.QuestionUsageSnapshot;
import pl.opyhl.oneoften.service.QuestionUsageService;

@RestController
@RequestMapping("/api/questions/usage")
public class QuestionUsageController {
    private final QuestionUsageService usageService;
    private final EventBus bus;

    public QuestionUsageController(QuestionUsageService usageService, EventBus bus) {
        this.usageService = usageService;
        this.bus = bus;
    }

    @GetMapping
    public QuestionUsageSnapshot usage() {
        return new QuestionUsageSnapshot(usageService.snapshot());
    }

    @PostMapping("/reset")
    public ResponseEntity<QuestionUsageSnapshot> reset() {
        usageService.clearAll();
        bus.publish(new Event("QUESTION_USAGE_RESET", null, null, null));
        return new ResponseEntity<>(new QuestionUsageSnapshot(usageService.snapshot()), HttpStatus.OK);
    }
}
