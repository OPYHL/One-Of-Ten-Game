package pl.opyhl.oneoften.model.question;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class QuestionUsageSnapshot {
    private Map<String, Map<String, List<String>>> used = new LinkedHashMap<>();

    public QuestionUsageSnapshot() {
    }

    public QuestionUsageSnapshot(Map<String, Map<String, List<String>>> used) {
        this.used = used != null ? used : new LinkedHashMap<>();
    }

    public Map<String, Map<String, List<String>>> getUsed() {
        return used;
    }

    public void setUsed(Map<String, Map<String, List<String>>> used) {
        this.used = used != null ? used : new LinkedHashMap<>();
    }
}
