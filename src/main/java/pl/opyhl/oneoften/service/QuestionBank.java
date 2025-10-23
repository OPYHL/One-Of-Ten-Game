package pl.opyhl.oneoften.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import pl.opyhl.oneoften.model.question.*;

import java.io.IOException;
import java.io.InputStream;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class QuestionBank {
    private final Map<String, LinkedHashMap<String, List<QuestionEntry>>> catalog = new LinkedHashMap<>();
    private final Map<String, QuestionEntry> index = new HashMap<>();

    public QuestionBank(ObjectMapper mapper) {
        loadQuestions(mapper);
    }

    private void loadQuestions(ObjectMapper mapper) {
        ClassPathResource res = new ClassPathResource("questions.json");
        if (!res.exists()) {
            throw new IllegalStateException("questions.json not found on classpath");
        }
        try (InputStream in = res.getInputStream()) {
            TypeReference<LinkedHashMap<String, LinkedHashMap<String, List<QuestionEntry>>>> type =
                    new TypeReference<>() {};
            LinkedHashMap<String, LinkedHashMap<String, List<QuestionEntry>>> data = mapper.readValue(in, type);
            catalog.clear();
            index.clear();
            data.forEach((difficulty, categories) -> {
                LinkedHashMap<String, List<QuestionEntry>> normCats = new LinkedHashMap<>();
                categories.forEach((category, entries) -> {
                    List<QuestionEntry> normalized = new ArrayList<>();
                    int counter = 1;
                    for (QuestionEntry entry : entries) {
                        if (entry.getId() == null || entry.getId().isBlank()) {
                            entry.setId(slug(difficulty) + "-" + slug(category) + "-" + counter);
                        }
                        entry.setDifficulty(difficulty);
                        entry.setCategory(category);
                        entry.setOrder(counter++);
                        normalized.add(entry);
                        index.put(entry.getId(), entry);
                    }
                    normCats.put(category, normalized);
                });
                catalog.put(difficulty, normCats);
            });
        } catch (IOException e) {
            throw new IllegalStateException("Cannot load questions.json", e);
        }
    }

    private String slug(String input) {
        String base = Optional.ofNullable(input).orElse("").replaceAll("[^A-Za-z0-9]+", "").toUpperCase(Locale.ROOT);
        if (base.isBlank()) {
            base = "Q" + new Random().nextInt(1000);
        }
        return base;
    }

    public QuestionCatalog getCatalog() {
        List<QuestionDifficulty> diffs = catalog.entrySet().stream()
                .map(diffEntry -> {
                    String diffName = diffEntry.getKey();
                    List<QuestionCategory> cats = diffEntry.getValue().entrySet().stream()
                            .map(catEntry -> new QuestionCategory(
                                    catEntry.getKey(),
                                    catEntry.getKey(),
                                    catEntry.getValue().stream()
                                            .map(q -> new QuestionSummary(q.getId(), labelForQuestion(q), q.getOrder()))
                                            .collect(Collectors.toList())
                            ))
                            .collect(Collectors.toList());
                    return new QuestionDifficulty(diffName, diffName, cats);
                })
                .collect(Collectors.toList());
        return new QuestionCatalog(diffs);
    }

    private String labelForQuestion(QuestionEntry entry) {
        return String.format(Locale.ROOT, "%02d. %s", entry.getOrder(), entry.getQuestion());
    }

    public Optional<QuestionDetail> find(String difficulty, String category, String id) {
        if (id != null && index.containsKey(id)) {
            QuestionEntry entry = index.get(id);
            return Optional.of(new QuestionDetail(
                    entry.getId(), entry.getDifficulty(), entry.getCategory(), entry.getQuestion(), entry.getAnswer(), entry.getOrder()
            ));
        }
        LinkedHashMap<String, List<QuestionEntry>> diff = catalog.get(difficulty);
        if (diff == null) return Optional.empty();
        List<QuestionEntry> entries = diff.get(category);
        if (entries == null) return Optional.empty();
        return entries.stream()
                .filter(q -> Objects.equals(q.getId(), id))
                .findFirst()
                .map(q -> new QuestionDetail(q.getId(), q.getDifficulty(), q.getCategory(), q.getQuestion(), q.getAnswer(), q.getOrder()));
    }
}
