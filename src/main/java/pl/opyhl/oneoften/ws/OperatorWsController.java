package pl.opyhl.oneoften.ws;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;
import pl.opyhl.oneoften.service.GameService;
import pl.opyhl.oneoften.ws.dto.*;

@Controller
public class OperatorWsController {
    private final GameService game;
    public OperatorWsController(GameService game) { this.game = game; }

    // Operator/Host
    @MessageMapping("/setAnswering") public void setAnswering(SetAnsweringDto dto){ game.setAnswering(dto.getPlayerId()); }
    @MessageMapping("/judge")        public void judge(JudgeDto dto){ game.judge(dto.getPlayerId(), dto.isCorrect()); }
    @MessageMapping("/reset")        public void reset(SimpleDto ignored){ game.reset(); }
    @MessageMapping("/newGame")      public void newGame(SimpleDto ignored){ game.newGame(); }

    // Start
    @MessageMapping("/host/start")    public void hostStart(SimpleDto ignored){ game.hostStartRound(); }
    @MessageMapping("/host/next")     public void hostNext(SimpleDto ignored){ game.hostNextQuestion(); }
    @MessageMapping("/host/readDone") public void hostReadDone(SimpleDto ignored){ game.hostReadDone(); }
    @MessageMapping("/host/selectQuestion") public void selectQuestion(SelectQuestionDto dto){ game.selectQuestion(dto.getDifficulty(), dto.getCategory(), dto.getQuestionId()); }

    // Pierwszy buzzer
    @MessageMapping("/openBuzzers")  public void openBuzzers(SimpleDto ignored){ game.openBuzzersStart(); }
    @MessageMapping("/buzz")         public void buzz(BuzzDto dto){ game.buzzStart(dto.getPlayerId()); }
    @MessageMapping("/roundBuzz")    public void roundBuzz(RoundBuzzDto dto){ game.roundBuzz(dto.getPlayerId()); }

    // Sygnalizacja z display
    @MessageMapping("/introDone")    public void introDone(SimpleDto ignored){ game.introDone(); }
    @MessageMapping("/boomDone")     public void boomDone(SimpleDto ignored){ game.boomDone(); }

    // Wybór przeciwnika
    @MessageMapping("/proposeTarget") public void proposeTarget(ChooseTargetDto dto){ game.proposeTarget(dto.getFromId(), dto.getToId()); }
    @MessageMapping("/approveTarget") public void approveTarget(ApproveTargetDto dto){ game.approveTarget(dto.isAccept()); }

    // Meta
    @MessageMapping("/setName")   public void setName(SetNameDto dto){ game.setName(dto.getPlayerId(), dto.getName(), dto.isForce()); }
    @MessageMapping("/setGender") public void setGender(SetGenderDto dto){ game.setGender(dto.getPlayerId(), dto.getGender()); }
    @MessageMapping("/playCue")   public void playCue(PlayCueDto dto){ game.playCue(dto.getCue()); }

    // Zapis
    @MessageMapping("/saveResults") public void saveResults(SimpleDto ignored){ game.saveResults(); }

    @MessageMapping("/operator/answerTimer") public void updateAnswerTimer(UpdateAnswerTimerDto dto){ game.updateAnswerTimer(dto.getSeconds()); }
}
