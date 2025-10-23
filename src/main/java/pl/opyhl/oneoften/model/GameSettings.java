package pl.opyhl.oneoften.model;

public class GameSettings {
    private int answerTimerMs;
    private int cooldownMs;

    private int answerMinMs;
    private int answerMaxMs;
    private int answerStepMs;

    public GameSettings() {}

    public GameSettings(int answerTimerMs, int cooldownMs, int answerMinMs, int answerMaxMs, int answerStepMs) {
        this.answerTimerMs = answerTimerMs;
        this.cooldownMs = cooldownMs;
        this.answerMinMs = answerMinMs;
        this.answerMaxMs = answerMaxMs;
        this.answerStepMs = answerStepMs;
    }

    public int getAnswerTimerMs(){ return answerTimerMs; }
    public void setAnswerTimerMs(int answerTimerMs){ this.answerTimerMs = answerTimerMs; }

    public int getCooldownMs(){ return cooldownMs; }
    public void setCooldownMs(int cooldownMs){ this.cooldownMs = cooldownMs; }

    public int getAnswerMinMs(){ return answerMinMs; }
    public void setAnswerMinMs(int answerMinMs){ this.answerMinMs = answerMinMs; }

    public int getAnswerMaxMs(){ return answerMaxMs; }
    public void setAnswerMaxMs(int answerMaxMs){ this.answerMaxMs = answerMaxMs; }

    public int getAnswerStepMs(){ return answerStepMs; }
    public void setAnswerStepMs(int answerStepMs){ this.answerStepMs = answerStepMs; }
}
