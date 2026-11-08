/**
 * Cooking mode logic.
 * Depends on: api.js, voice.js, timer.js
 */

const urlParams = new URLSearchParams(window.location.search);
const recipeId = urlParams.get("id");

let meal = null;
let steps = [];
let currentStep = 0;
let wakeLock = null;
let activeTimers = [];

// --- DOM refs (set in init) ---
let stepTextEl;
let stepCounterEl;
let progressFillEl;
let listeningIndicatorEl;
let timerListEl;
let prevBtn;
let repeatBtn;
let nextBtn;
let exitBtn;
let titleEl;

// --- Helpers ---
function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );
}

function splitSteps(instructions) {
  if (!instructions) return [];
  return instructions
    .split(/\r?\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// --- Rendering ---
function renderStep() {
  if (steps.length === 0) {
    stepTextEl.textContent = "No instructions available for this recipe.";
    stepCounterEl.textContent = "";
    return;
  }
  stepTextEl.textContent = steps[currentStep];
  stepCounterEl.textContent = `Step ${currentStep + 1} of ${steps.length}`;
  const pct = ((currentStep + 1) / steps.length) * 100;
  progressFillEl.style.width = `${pct}%`;
  prevBtn.disabled = currentStep === 0;
  nextBtn.disabled = currentStep === steps.length - 1;
}

async function announceCurrentStep() {
  if (steps.length === 0) return;
  const text = `Step ${currentStep + 1}. ${steps[currentStep]}`;
  await Voice.speak(text);
}

// --- Navigation ---
async function goToStep(index, announce = true) {
  if (index < 0 || index >= steps.length) return;
  currentStep = index;
  renderStep();
  if (announce) {
    Voice.stopSpeaking();
    await announceCurrentStep();
  }
}

function nextStep() {
  if (currentStep < steps.length - 1) {
    goToStep(currentStep + 1);
  } else {
    Voice.speak("That was the last step. Enjoy your meal!");
  }
}

function prevStep() {
  if (currentStep > 0) {
    goToStep(currentStep - 1);
  }
}

function repeatStep() {
  Voice.stopSpeaking();
  announceCurrentStep();
}

// --- Voice command handling ---
function handleCommand(transcript) {
  const t = transcript.toLowerCase().trim();

  // Timer commands take priority — "set timer for 5 minutes" contains "timer"
  const timerCmd = Timer.parseTimerCommand(t);
  if (timerCmd) {
    startVoiceTimer(timerCmd);
    return;
  }

  // Navigation commands
  if (/\bnext\b/.test(t) || /\bforward\b/.test(t)) {
    nextStep();
    return;
  }
  if (/\bback\b/.test(t) || /\bprevious\b/.test(t)) {
    prevStep();
    return;
  }
  if (/\brepeat\b/.test(t) || /\bagain\b/.test(t)) {
    repeatStep();
    return;
  }
  if (/\bstop\b/.test(t) || /\bpause\b/.test(t)) {
    Voice.stopSpeaking();
    return;
  }
  if (/\bexit\b/.test(t) || /\bquit\b/.test(t) || /\bdone\b/.test(t)) {
    exitCookingMode();
    return;
  }
  // "where am I" / "what step" → re-read current step
  if (/\bwhere\b/.test(t) || /\bwhat step\b/.test(t) || /\bcurrent\b/.test(t)) {
    repeatStep();
    return;
  }
}

// --- Timers ---
function startVoiceTimer({ seconds, label }) {
  const timer = Timer.createTimer({
    seconds,
    label,
    onTick: (remaining) => updateTimerDisplay(),
    onDone: () => {
      updateTimerDisplay();
      Voice.speak(`Timer finished: ${label}`);
    },
  });
  activeTimers.push(timer);
  updateTimerDisplay();
  Voice.speak(`Timer set for ${label}`);
}

function updateTimerDisplay() {
  if (activeTimers.length === 0) {
    timerListEl.innerHTML = "";
    return;
  }
  timerListEl.innerHTML = activeTimers
    .filter((t) => t.getRemaining() > 0)
    .map((t) => {
      const rem = t.getRemaining();
      const m = Math.floor(rem / 60);
      const s = rem % 60;
      return `<div class="active-timer">⏱ ${t.getLabel()} — ${m}:${String(s).padStart(2, "0")}</div>`;
    })
    .join("");
}

// --- Wake Lock ---
async function requestWakeLock() {
  try {
    if ("wakeLock" in navigator) {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => {
        console.log("Wake lock released");
      });
    }
  } catch (err) {
    console.warn("Wake Lock error:", err);
  }
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release().catch(() => {});
    wakeLock = null;
  }
}

// --- Listening indicator ---
function updateListeningIndicator() {
  if (!listeningIndicatorEl) return;
  const { stt } = Voice.voiceSupported();
  if (!stt) {
    listeningIndicatorEl.textContent =
      "⚠️ Voice commands not supported in this browser";
    listeningIndicatorEl.className = "listening-indicator unsupported";
    return;
  }
  if (Voice.isListening()) {
    listeningIndicatorEl.textContent =
      '🎤 Listening — say "next", "back", "repeat", or "set timer for 5 minutes"';
    listeningIndicatorEl.className = "listening-indicator active";
  } else {
    listeningIndicatorEl.textContent = "🎤 Microphone off";
    listeningIndicatorEl.className = "listening-indicator";
  }
}

// --- Exit ---
function exitCookingMode() {
  Voice.stopListening();
  Voice.stopSpeaking();
  releaseWakeLock();
  activeTimers.forEach((t) => t.cancel());
  window.location.href = `recipe.html?id=${encodeURIComponent(recipeId)}`;
}

// --- Init ---
document.addEventListener("DOMContentLoaded", async () => {
  // Cache DOM refs
  stepTextEl = document.getElementById("step-text");
  stepCounterEl = document.getElementById("step-counter");
  progressFillEl = document.getElementById("progress-fill");
  listeningIndicatorEl = document.getElementById("listening-indicator");
  timerListEl = document.getElementById("timer-list");
  prevBtn = document.getElementById("prev-btn");
  repeatBtn = document.getElementById("repeat-btn");
  nextBtn = document.getElementById("next-btn");
  exitBtn = document.getElementById("exit-btn");
  titleEl = document.getElementById("cook-title");

  // Wire buttons
  prevBtn.addEventListener("click", prevStep);
  repeatBtn.addEventListener("click", repeatStep);
  nextBtn.addEventListener("click", nextStep);
  exitBtn.addEventListener("click", exitCookingMode);

  // Validate recipe ID
  if (!recipeId) {
    document.body.innerHTML =
      '<p style="padding:2rem;text-align:center;">No recipe ID. <a href="index.html">Go back</a></p>';
    return;
  }

  // Fetch recipe
  try {
    meal = await getRecipeById(recipeId);
    if (!meal) throw new Error("Recipe not found");
    steps = splitSteps(meal.strInstructions);
    titleEl.textContent = meal.strMeal;
  } catch (err) {
    document.body.innerHTML = `<p style="padding:2rem;text-align:center;">Could not load recipe. <a href="index.html">Go back</a></p>`;
    console.error(err);
    return;
  }

  // No steps? Bail.
  if (steps.length === 0) {
    stepTextEl.textContent = "This recipe has no step-by-step instructions.";
    return;
  }

  // Initial render
  renderStep();

  // Request wake lock (before speaking — user gesture isn't required for wakeLock, but happens after page load)
  await requestWakeLock();

  // Speak first step after a short delay so page isn't jarring
  setTimeout(() => announceCurrentStep(), 800);

  // Start listening
  const { stt } = Voice.voiceSupported();
  if (stt) {
    Voice.startListening(handleCommand);
    // Voice.isListening() may be false for a beat — poll briefly
    setTimeout(updateListeningIndicator, 300);
  } else {
    updateListeningIndicator();
  }

  // Release wake lock when tab hidden
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      releaseWakeLock();
    } else {
      requestWakeLock();
    }
  });

  // Clean up on unload
  window.addEventListener("beforeunload", () => {
    Voice.stopListening();
    Voice.stopSpeaking();
    releaseWakeLock();
  });
});
