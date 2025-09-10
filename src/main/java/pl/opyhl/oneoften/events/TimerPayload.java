package pl.opyhl.oneoften.events;

public record TimerPayload(int remainingMs, boolean active) { }
