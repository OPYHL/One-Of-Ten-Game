package pl.opyhl.oneoften.ws;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import pl.opyhl.oneoften.service.GameService;

@Controller
public class SyncWsController {

    private final GameService game;
    private final SimpMessagingTemplate broker;

    @Autowired
    public SyncWsController(GameService game, SimpMessagingTemplate broker) {
        this.game = game;
        this.broker = broker;
    }

    @MessageMapping("/requestState")
    public void requestState() {
        broker.convertAndSend("/topic/state", game.getState());
    }
}
