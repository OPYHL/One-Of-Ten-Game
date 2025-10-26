package pl.opyhl.oneoften.model;

public class HostDashboard {
    private ActiveQuestion activeQuestion;
    private HostMetrics metrics;
    private String hostName;
    private String welcomeTitle;
    private String welcomeSubtitle;

    public HostDashboard() {}

    public HostDashboard(ActiveQuestion activeQuestion, HostMetrics metrics, String hostName, String welcomeTitle, String welcomeSubtitle) {
        this.activeQuestion = activeQuestion;
        this.metrics = metrics;
        this.hostName = hostName;
        this.welcomeTitle = welcomeTitle;
        this.welcomeSubtitle = welcomeSubtitle;
    }

    public ActiveQuestion getActiveQuestion(){ return activeQuestion; }
    public void setActiveQuestion(ActiveQuestion activeQuestion){ this.activeQuestion = activeQuestion; }

    public HostMetrics getMetrics(){ return metrics; }
    public void setMetrics(HostMetrics metrics){ this.metrics = metrics; }

    public String getHostName(){ return hostName; }
    public void setHostName(String hostName){ this.hostName = hostName; }

    public String getWelcomeTitle(){ return welcomeTitle; }
    public void setWelcomeTitle(String welcomeTitle){ this.welcomeTitle = welcomeTitle; }

    public String getWelcomeSubtitle(){ return welcomeSubtitle; }
    public void setWelcomeSubtitle(String welcomeSubtitle){ this.welcomeSubtitle = welcomeSubtitle; }
}
