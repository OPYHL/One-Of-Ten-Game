package pl.opyhl.oneoften.model;

public class Player {
    public enum Gender { MALE, FEMALE }

    private int id;
    private String name;
    private Gender gender = Gender.MALE;
    private int lives = 3;
    private int score = 0;
    private boolean eliminated = false;
    private Integer finalRank = null;
    private boolean joined = false;

    public Player() {}
    public Player(int id, String name){ this.id=id; this.name=name; }

    public int getId(){ return id; }
    public void setId(int id){ this.id = id; }
    public String getName(){ return name; }
    public void setName(String name){ this.name = name; }
    public Gender getGender(){ return gender; }
    public void setGender(Gender gender){ this.gender = gender; }
    public int getLives(){ return lives; }
    public void setLives(int lives){ this.lives = lives; }
    public int getScore(){ return score; }
    public void setScore(int score){ this.score = score; }
    public boolean isEliminated(){ return eliminated; }
    public void setEliminated(boolean eliminated){ this.eliminated = eliminated; }

    public Integer getFinalRank(){ return finalRank; }
    public void setFinalRank(Integer finalRank){ this.finalRank = finalRank; }

    public boolean isJoined(){ return joined; }
    public void setJoined(boolean joined){ this.joined = joined; }
}
