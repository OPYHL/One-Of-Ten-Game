package pl.opyhl.oneoften.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class QuestionUsageService {
    private static final Logger log = LoggerFactory.getLogger(QuestionUsageService.class);

    private final ObjectMapper mapper;
    private final Path storageDir = Paths.get("results");
    private final Path storageFile = storageDir.resolve("used-questions.json");
    private final Map<String, Map<String, Set<String>>> usage = new LinkedHashMap<>();

    public QuestionUsageService(ObjectMapper mapper) {
        this.mapper = mapper;
        load();
    }

    private synchronized void load() {
        usage.clear();
        if (!Files.exists(storageFile)) {
            return;
        }
        try (InputStream in = Files.newInputStream(storageFile)) {
            TypeReference<LinkedHashMap<String, LinkedHashMap<String, List<String>>>> type =
                    new TypeReference<>() {};
            Map<String, LinkedHashMap<String, List<String>>> raw = mapper.readValue(in, type);
            if (raw == null) {
                return;
            }
            raw.forEach((difficulty, categories) -> {
                if (difficulty == null || categories == null) {
                    return;
                }
                Map<String, Set<String>> catMap = usage.computeIfAbsent(difficulty, key -> new LinkedHashMap<>());
                categories.forEach((category, list) -> {
                    if (category == null || list == null) {
                        return;
                    }
                    Set<String> set = catMap.computeIfAbsent(category, key -> new LinkedHashSet<>());
                    list.stream()
                            .filter(item -> item != null && !item.isBlank())
                            .map(String::trim)
                            .forEach(set::add);
                });
            });
        } catch (IOException e) {
            log.warn("Nie udało się wczytać stanu wykorzystanych pytań", e);
        }
    }

    public synchronized Map<String, Map<String, List<String>>> snapshot() {
        Map<String, Map<String, List<String>>> copy = new LinkedHashMap<>();
        usage.forEach((difficulty, categories) -> {
            Map<String, List<String>> catCopy = new LinkedHashMap<>();
            categories.forEach((category, set) -> {
                if (set != null && !set.isEmpty()) {
                    catCopy.put(category, new ArrayList<>(set));
                }
            });
            if (!catCopy.isEmpty()) {
                copy.put(difficulty, catCopy);
            }
        });
        return copy;
    }

    public synchronized boolean markUsed(String difficulty, String category, String questionId) {
        if (isBlank(difficulty) || isBlank(category) || isBlank(questionId)) {
            return false;
        }
        String diffKey = difficulty.trim();
        String catKey = category.trim();
        String questionKey = questionId.trim();
        Map<String, Set<String>> categories = usage.computeIfAbsent(diffKey, key -> new LinkedHashMap<>());
        Set<String> set = categories.computeIfAbsent(catKey, key -> new LinkedHashSet<>());
        if (set.contains(questionKey)) {
            return false;
        }
        set.add(questionKey);
        persist();
        return true;
    }

    public synchronized boolean clearAll() {
        boolean hadData = !usage.isEmpty();
        usage.clear();
        persist();
        return hadData;
    }

    private synchronized void persist() {
        Map<String, Map<String, List<String>>> export = new LinkedHashMap<>();
        usage.forEach((difficulty, categories) -> {
            Map<String, List<String>> catExport = new LinkedHashMap<>();
            categories.forEach((category, set) -> {
                if (set != null && !set.isEmpty()) {
                    catExport.put(category, new ArrayList<>(set));
                }
            });
            if (!catExport.isEmpty()) {
                export.put(difficulty, catExport);
            }
        });
        try {
            if (export.isEmpty()) {
                Files.deleteIfExists(storageFile);
                return;
            }
            Files.createDirectories(storageDir);
            mapper.writerWithDefaultPrettyPrinter().writeValue(storageFile.toFile(), export);
        } catch (IOException e) {
            log.warn("Nie udało się zapisać stanu pytań", e);
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
