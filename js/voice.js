/**
 * Voice wrapper — speech synthesis (TTS) + speech recognition (STT).
 * Depends on nothing. Loaded by cook.html.
 *
 * Public API:
 *   speak(text, opts)          → Promise resolves when speech ends
 *   stopSpeaking()
 *   isSpeaking()               → boolean
 *   startListening(onCommand)  → starts continuous recognition
 *   stopListening()
 *   isListening()              → boolean
 *   voiceSupported()           → { tts: bool, stt: bool }
 */

const Voice = (() => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const ttsSupported = "speechSynthesis" in window;
  const sttSupported = !!SR;

  let recognition = null;
  let listening = false;
  let manuallyStopped = false;
  let onCommandCallback = null;

  // --- Speech synthesis (TTS) ---
  function isSpeaking() {
    return ttsSupported && window.speechSynthesis.speaking;
  }

  function stopSpeaking() {
    if (!ttsSupported) return;
    window.speechSynthesis.cancel();
  }

  /**
   * Speak text and resolve when finished.
   * @param {string} text
   * @param {object} [opts] { rate, pitch, volume, lang }
   * @returns {Promise<void>}
   */
  function speak(text, opts = {}) {
    return new Promise((resolve) => {
      if (!ttsSupported || !text) {
        resolve();
        return;
      }
      // Cancel any queued speech so the latest step speaks cleanly
      window.speechSynthesis.cancel();

      const u = new SpeechSynthesisUtterance(text);
      u.rate = opts.rate ?? 0.95;
      u.pitch = opts.pitch ?? 1;
      u.volume = opts.volume ?? 1;
      u.lang = opts.lang ?? "en-US";

      u.onend = () => resolve();
      u.onerror = (e) => {
        // 'interrupted' fires when cancel() is called — treat as normal end
        if (e.error !== "interrupted") {
          console.warn("TTS error:", e.error);
        }
        resolve();
      };

      window.speechSynthesis.speak(u);
    });
  }

  // --- Speech recognition (STT) ---
  function isListening() {
    return listening;
  }

  /**
   * Start continuous recognition. Calls onCommand(finalTranscript) for each
   * finished phrase. Auto-restarts on silence (Chrome behavior).
   * @param {(transcript: string) => void} onCommand
   */
  function startListening(onCommand) {
    if (!sttSupported || listening) return;
    onCommandCallback = onCommand;
    manuallyStopped = false;

    recognition = new SR();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onstart = () => {
      listening = true;
    };

    recognition.onresult = (e) => {
      // Only handle final results
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          const transcript = e.results[i][0].transcript.trim().toLowerCase();
          if (transcript && onCommandCallback) {
            onCommandCallback(transcript);
          }
        }
      }
    };

    recognition.onerror = (e) => {
      // 'no-speech' and 'aborted' are expected — Chrome times out after silence
      if (e.error === "no-speech" || e.error === "aborted") {
        return;
      }
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        console.warn("Microphone permission denied");
        listening = false;
        manuallyStopped = true;
      } else {
        console.warn("STT error:", e.error);
      }
    };

    recognition.onend = () => {
      listening = false;
      // Auto-restart if the user didn't explicitly stop
      if (!manuallyStopped) {
        try {
          recognition.start();
        } catch (_) {
          // Ignore — can throw if start is called twice too quickly
        }
      }
    };

    try {
      recognition.start();
    } catch (err) {
      console.warn("Could not start listening:", err);
    }
  }

  function stopListening() {
    manuallyStopped = true;
    if (recognition) {
      try {
        recognition.stop();
      } catch (_) {}
      recognition = null;
    }
    listening = false;
  }

  return {
    speak,
    stopSpeaking,
    isSpeaking,
    startListening,
    stopListening,
    isListening,
    voiceSupported: () => ({ tts: ttsSupported, stt: sttSupported }),
  };
})();
