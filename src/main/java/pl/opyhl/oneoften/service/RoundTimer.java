package pl.opyhl.oneoften.service;

import org.springframework.stereotype.Component;

import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.BiConsumer;

/**
 * Stabilny timer:
 * - tick co 100 ms,
 * - niezależny terminator gwarantujący końcowy sygnał (0,false),
 * - zawsze stopuje poprzednie zadania przed startem nowego,
 * - odporność na wyjątki (nie uwali wątku).
 */
@Component
public class RoundTimer {

    private final ScheduledExecutorService exec = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "RoundTimer");
        t.setDaemon(true);
        return t;
    });

    private final Object lock = new Object();
    private ScheduledFuture<?> ticker;     // cykliczne ticki
    private ScheduledFuture<?> terminator; // jednorazowe domknięcie
    private static final long TICK_MS = 100L;

    public void start(int totalMs, BiConsumer<Integer, Boolean> sink){
        if (totalMs <= 0){
            safeSink(sink, 0, false);
            return;
        }
        synchronized (lock){
            stop(); // twardy reset

            final long start = System.nanoTime();
            final AtomicBoolean finished = new AtomicBoolean(false);

            // Ticker
            ticker = exec.scheduleAtFixedRate(() -> {
                try {
                    int elapsed = (int)((System.nanoTime() - start)/1_000_000L);
                    int remaining = Math.max(0, totalMs - elapsed);
                    boolean active = remaining > 0;
                    safeSink(sink, remaining, active);
                    if (!active && finished.compareAndSet(false, true)) {
                        cancelInternal();
                    }
                } catch (Throwable ignored) {}
            }, 0, TICK_MS, TimeUnit.MILLISECONDS);

            // Terminator – domyka nawet gdyby ostatni tik nie zdążył
            terminator = exec.schedule(() -> {
                try {
                    if (finished.compareAndSet(false, true)){
                        safeSink(sink, 0, false);
                    }
                } finally {
                    cancelInternal();
                }
            }, totalMs + 50L, TimeUnit.MILLISECONDS); // +50 ms marginesu
        }
    }

    public void stop(){
        synchronized (lock){ cancelInternal(); }
    }

    private void cancelInternal(){
        if (ticker != null){ ticker.cancel(false); ticker = null; }
        if (terminator != null){ terminator.cancel(false); terminator = null; }
    }

    private void safeSink(BiConsumer<Integer, Boolean> sink, int rem, boolean act){
        try { sink.accept(rem, act); } catch (Throwable ignored) {}
    }
}
