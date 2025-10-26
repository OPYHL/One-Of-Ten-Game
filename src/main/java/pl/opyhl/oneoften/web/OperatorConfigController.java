package pl.opyhl.oneoften.web;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pl.opyhl.oneoften.model.config.OperatorConfig;
import pl.opyhl.oneoften.service.OperatorConfigService;

@RestController
@RequestMapping("/api/operator")
public class OperatorConfigController {
    private final OperatorConfigService configService;

    public OperatorConfigController(OperatorConfigService configService) {
        this.configService = configService;
    }

    @GetMapping("/config")
    public OperatorConfig config(){
        return configService.getConfig();
    }
}
