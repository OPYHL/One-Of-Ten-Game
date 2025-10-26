package pl.opyhl.oneoften.model;

public class HostMetrics {
    private long startedAt;
    private int askedCount;
    private long totalQuestionTimeMs;
    private long lastQuestionTimeMs;

    public HostMetrics() {}

    public HostMetrics(long startedAt, int askedCount, long totalQuestionTimeMs, long lastQuestionTimeMs) {
        this.startedAt = startedAt;
        this.askedCount = askedCount;
        this.totalQuestionTimeMs = totalQuestionTimeMs;
        this.lastQuestionTimeMs = lastQuestionTimeMs;
    }

    public long getStartedAt(){ return startedAt; }
    public void setStartedAt(long startedAt){ this.startedAt = startedAt; }

    public int getAskedCount(){ return askedCount; }
    public void setAskedCount(int askedCount){ this.askedCount = askedCount; }

    public long getTotalQuestionTimeMs(){ return totalQuestionTimeMs; }
    public void setTotalQuestionTimeMs(long totalQuestionTimeMs){ this.totalQuestionTimeMs = totalQuestionTimeMs; }

    public long getLastQuestionTimeMs(){ return lastQuestionTimeMs; }
    public void setLastQuestionTimeMs(long lastQuestionTimeMs){ this.lastQuestionTimeMs = lastQuestionTimeMs; }

    public double getAverageQuestionTimeMs(){
        if (askedCount <= 0) return 0.0;
        return (double) totalQuestionTimeMs / (double) askedCount;
    }
}
