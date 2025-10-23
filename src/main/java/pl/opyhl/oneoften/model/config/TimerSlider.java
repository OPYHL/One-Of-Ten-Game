package pl.opyhl.oneoften.model.config;

public class TimerSlider {
    private int minSeconds;
    private int maxSeconds;
    private int defaultSeconds;
    private int stepSeconds = 1;

    public int getMinSeconds(){ return minSeconds; }
    public void setMinSeconds(int minSeconds){ this.minSeconds = minSeconds; }

    public int getMaxSeconds(){ return maxSeconds; }
    public void setMaxSeconds(int maxSeconds){ this.maxSeconds = maxSeconds; }

    public int getDefaultSeconds(){ return defaultSeconds; }
    public void setDefaultSeconds(int defaultSeconds){ this.defaultSeconds = defaultSeconds; }

    public int getStepSeconds(){ return stepSeconds; }
    public void setStepSeconds(int stepSeconds){ this.stepSeconds = stepSeconds; }
}
