package pl.opyhl.oneoften.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import pl.opyhl.oneoften.model.config.OperatorConfig;

import java.io.IOException;
import java.io.InputStream;

@Service
public class OperatorConfigService {
    private final OperatorConfig config;

    public OperatorConfigService() {
        this.config = loadConfig();
    }

    private OperatorConfig loadConfig() {
        ClassPathResource res = new ClassPathResource("operator.yml");
        if (!res.exists()) {
            OperatorConfig fallback = new OperatorConfig();
            var answer = new pl.opyhl.oneoften.model.config.TimerSlider();
            answer.setMinSeconds(3);
            answer.setMaxSeconds(15);
            answer.setDefaultSeconds(5);
            answer.setStepSeconds(1);
            var cooldown = new pl.opyhl.oneoften.model.config.TimerSlider();
            cooldown.setDefaultSeconds(3);
            cooldown.setMinSeconds(1);
            cooldown.setMaxSeconds(10);
            cooldown.setStepSeconds(1);
            fallback.setAnswer(answer);
            fallback.setCooldown(cooldown);
            var host = new pl.opyhl.oneoften.model.config.HostConfig();
            host.setName("Marcel");
            host.setWelcomeTitle("Witaj Marcel!");
            host.setWelcomeSubtitle("Zaraz zaczynamy — przygotuj się na pierwsze pytania.");
            fallback.setHost(host);
            return fallback;
        }
        try (InputStream in = res.getInputStream()) {
            ObjectMapper mapper = new ObjectMapper(new YAMLFactory());
            return mapper.readValue(in, OperatorConfig.class);
        } catch (IOException e) {
            throw new IllegalStateException("Cannot load operator.yml", e);
        }
    }

    public OperatorConfig getConfig(){ return config; }
}
