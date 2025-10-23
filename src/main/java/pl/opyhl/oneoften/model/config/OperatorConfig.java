package pl.opyhl.oneoften.model.config;

public class OperatorConfig {
    private TimerSlider answer;
    private TimerSlider cooldown;
    private HostConfig host;

    public TimerSlider getAnswer(){ return answer; }
    public void setAnswer(TimerSlider answer){ this.answer = answer; }

    public TimerSlider getCooldown(){ return cooldown; }
    public void setCooldown(TimerSlider cooldown){ this.cooldown = cooldown; }

    public HostConfig getHost(){ return host; }
    public void setHost(HostConfig host){ this.host = host; }
}
