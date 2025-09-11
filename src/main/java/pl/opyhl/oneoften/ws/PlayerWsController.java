package pl.opyhl.oneoften.ws;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;
import pl.opyhl.oneoften.service.GameService;
import pl.opyhl.oneoften.ws.dto.BuzzDto;
import pl.opyhl.oneoften.ws.dto.PlayerJoinDto;

@Controller
public class PlayerWsController {
    private final GameService game;
    public PlayerWsController(GameService game){ this.game = game; }

    @MessageMapping("/player/join")
    public void join(PlayerJoinDto dto) {
        var gender = GameService.parseGender(dto.gender());
        game.registerOrUpdatePlayer(dto.seat(), dto.name(), gender);
        // game.pushState() już leci w środku
    }

    // „Zgłaszam” po przeczytaniu pytania (phase == BUZZING)
    @MessageMapping("/player/buzz")
    public void buzz(BuzzDto dto) { game.roundBuzz(dto.getPlayerId()); }

    // Opcjonalnie „szybki start” kiedy host otworzy okno startowe (startBuzzOpen == true)
    @MessageMapping("/player/buzzStart")
    public void buzzStart(BuzzDto dto) { game.buzzStart(dto.getPlayerId()); }
}
