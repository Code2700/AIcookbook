/**
 * Timer module — voice-parsed timers for cooking.
 * Depends on nothing.
 *
 * Public API:
 *   parseTimerCommand(text)  → { seconds, label } | null
 *   createTimer({ seconds, label, onTick, onDone })  → timer object
 *   timer.cancel()
 *   stopAlarm()
 *   playAlarm()
 */

const Timer = (() => {
  const activeTimers = [];
  let audioCtx = null;

  /**
   * Parse a spoken timer command.
   * Examples handled:
   *   "set a timer for 5 minutes"
   *   "timer 90 seconds"
   *   "set timer for 1 minute 30 seconds"
   *   "2 minute timer"
   * @param {string} text
   * @returns {{seconds: number, label: string} | null}
   */
  function parseTimerCommand(text) {
    if (!text) return null;
    const t = text.toLowerCase().trim();

    // Must contain "timer" to be a timer command
    if (!t.includes("timer")) return null;

    let totalSeconds = 0;

    // Hours: "1 hour" / "2 hours"
    const hourMatch = t.match(/(\d+)\s*hour/);
    if (hourMatch) totalSeconds += parseInt(hourMatch[1], 10) * 3600;

    // Minutes: "5 minutes" / "5 minute" / "5 min"
    const minMatch = t.match(/(\d+)\s*min/);
    if (minMatch) totalSeconds += parseInt(minMatch[1], 10) * 60;

    // Seconds: "30 seconds" / "30 second" / "30 sec"
    const secMatch = t.match(/(\d+)\s*sec/);
    if (secMatch) totalSeconds += parseInt(secMatch[1], 10);

    // Just a bare number: "timer 5" → 5 minutes (most common kitchen interpretation)
    if (totalSeconds === 0) {
      const bareMatch = t.match(/timer\s+(?:for\s+)?(\d+)\b/);
      if (bareMatch) {
        totalSeconds = parseInt(bareMatch[1], 10) * 60;
      }
    }

    if (totalSeconds <= 0 || totalSeconds > 12 * 3600) return null;

    // Build a label like "5 min timer" or "1h 30m timer"
    const label = formatDuration(totalSeconds);
    return { seconds: totalSeconds, label };
  }

  function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const parts = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (s > 0) parts.push(`${s}s`);
    return parts.join(" ") || "0s";
  }

  /**
   * Create a timer.
   * @param {object} opts
   * @param {number} opts.seconds — total duration
   * @param {string} [opts.label] — display label
   * @param {(remaining: number) => void} [opts.onTick] — fires every second
   * @param {() => void} [opts.onDone] — fires when timer reaches 0
   * @returns {{ id, cancel, getRemaining, getLabel }}
   */
  function createTimer({ seconds, label, onTick, onDone }) {
    const id = Math.random().toString(36).slice(2);
    let remaining = seconds;
    let cancelled = false;

    const interval = setInterval(() => {
      if (cancelled) return;
      remaining -= 1;
      if (onTick) onTick(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        if (onDone) onDone();
        playAlarm();
        const idx = activeTimers.findIndex((t) => t.id === id);
        if (idx !== -1) activeTimers.splice(idx, 1);
      }
    }, 1000);

    const timer = {
      id,
      label: label || formatDuration(seconds),
      total: seconds,
      cancel() {
        cancelled = true;
        clearInterval(interval);
        const idx = activeTimers.findIndex((t) => t.id === id);
        if (idx !== -1) activeTimers.splice(idx, 1);
      },
      getRemaining: () => remaining,
      getLabel: () => timer.label,
    };

    activeTimers.push(timer);
    return timer;
  }

  /**
   * Play a beep alarm. No audio file — uses Web Audio API.
   * Beeps three times over ~1.5 seconds.
   */
  function playAlarm() {
    try {
      audioCtx =
        audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const now = audioCtx.currentTime;
      for (let i = 0; i < 3; i++) {
        const start = now + i * 0.5;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.value = 880; // A5
        gain.gain.setValueAtTime(0.3, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(start);
        osc.stop(start + 0.4);
      }
    } catch (err) {
      console.warn("Could not play alarm:", err);
    }
  }

  function stopAlarm() {
    // Oscillators are short-lived — nothing persistent to stop
    // Kept in API for future longer alarms
  }

  return {
    parseTimerCommand,
    createTimer,
    playAlarm,
    stopAlarm,
    formatDuration,
  };
})();
