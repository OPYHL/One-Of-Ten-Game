package pl.opyhl.oneoften.model.config;

public class HostConfig {
    private String name;
    private String welcomeTitle;
    private String welcomeSubtitle;

    public String getName(){ return name; }
    public void setName(String name){ this.name = name; }

    public String getWelcomeTitle(){ return welcomeTitle; }
    public void setWelcomeTitle(String welcomeTitle){ this.welcomeTitle = welcomeTitle; }

    public String getWelcomeSubtitle(){ return welcomeSubtitle; }
    public void setWelcomeSubtitle(String welcomeSubtitle){ this.welcomeSubtitle = welcomeSubtitle; }
}
