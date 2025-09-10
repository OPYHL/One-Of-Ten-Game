package pl.opyhl.oneoften.events;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import pl.opyhl.oneoften.model.GameState;

@Component
public class EventBus {
    private final SimpMessagingTemplate ws;

    public EventBus(SimpMessagingTemplate ws) { this.ws = ws; }

    public void state(GameState s) { ws.convertAndSend("/topic/state", s); }

    public void publish(Event e)   { ws.convertAndSend("/topic/events", e); }

    public void timer(int remainingMs, boolean active) {
        // <- używamy rekordu z pakietu pl.opyhl.oneoften.events
        ws.convertAndSend("/topic/timer", new TimerPayload(remainingMs, active));
    }
}
