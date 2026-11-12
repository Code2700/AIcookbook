/**
 * Camera preview + photo capture + AI ingredient detection.
 * Depends on: ai-vision.js
 */

let stream = null;
let videoEl = null;
let canvasEl = null;
let capturedDataUrl = null;
let detectedIngredients = [];

// --- DOM refs ---
let cameraRoot;
let cameraActions;
let captureBtn;
let captureReview;
let capturedImg;
let retakeBtn;
let analyzeBtn;
let analyzingStep;
let analyzingImg;
let ingredientStep;
let ingredientChips;
let addIngredientInput;
let resetBtn;
let findRecipesBtn;
let cameraStatus;

// --- Helpers ---
function showStatus(message, type = "info") {
  cameraStatus.textContent = message;
  cameraStatus.className = `camera-status status-${type}`;
  cameraStatus.hidden = !message;
}

function stopStream() {
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
}

// --- Camera lifecycle ---
async function startCamera() {
  cameraRoot.innerHTML = '<p class="camera-loading">Requesting camera…</p>';
  showStatus("", "info");

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showCameraError(
      "Your browser does not support camera access. Try Chrome or Edge.",
    );
    return;
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "environment",
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });

    cameraRoot.innerHTML = "";
    videoEl = document.createElement("video");
    videoEl.className = "camera-video";
    videoEl.autoplay = true;
    videoEl.playsInline = true;
    videoEl.muted = true;
    videoEl.srcObject = stream;
    cameraRoot.appendChild(videoEl);

    canvasEl = document.createElement("canvas");
    canvasEl.style.display = "none";
    cameraRoot.appendChild(canvasEl);

    await videoEl.play();

    cameraActions.hidden = false;
    captureReview.hidden = true;
    analyzingStep.hidden = true;
    ingredientStep.hidden = true;
  } catch (err) {
    console.error("Camera error:", err);
    if (err.name === "NotAllowedError") {
      showCameraError(
        "Camera permission denied. Allow camera access in your browser settings and try again.",
      );
    } else if (err.name === "NotFoundError") {
      showCameraError("No camera found on this device.");
    } else {
      showCameraError("Could not start camera: " + err.message);
    }
  }
}

function showCameraError(message) {
  cameraRoot.innerHTML = `
    <div class="camera-error">
      <p>📷 ${message}</p>
      <button id="retry-camera-btn" class="btn-primary" type="button">Try again</button>
    </div>
  `;
  const retry = document.getElementById("retry-camera-btn");
  if (retry) retry.addEventListener("click", startCamera);
  cameraActions.hidden = true;
  showStatus("", "info");
}

function capturePhoto() {
  if (!videoEl || !canvasEl || videoEl.videoWidth === 0) {
    showStatus("Camera not ready yet. Wait a moment and try again.", "error");
    return;
  }

  canvasEl.width = videoEl.videoWidth;
  canvasEl.height = videoEl.videoHeight;
  const ctx = canvasEl.getContext("2d");
  ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);

  capturedDataUrl = canvasEl.toDataURL("image/jpeg", 0.85);

  capturedImg.src = capturedDataUrl;
  captureReview.hidden = false;
  analyzingStep.hidden = true;
  ingredientStep.hidden = true;
  cameraActions.hidden = true;

  stopStream();
  showStatus("Photo captured. Analyze with AI or retake.", "success");
}

function retake() {
  capturedDataUrl = null;
  capturedImg.src = "";
  detectedIngredients = [];
  captureReview.hidden = true;
  analyzingStep.hidden = true;
  ingredientStep.hidden = true;
  startCamera();
}

// --- AI analysis flow ---
async function analyzePhoto() {
  if (!capturedDataUrl) return;

  // Move to analyzing state
  captureReview.hidden = true;
  analyzingImg.src = capturedDataUrl;
  analyzingStep.hidden = false;
  showStatus("", "info");

  try {
    const ingredients = await analyzeImage(capturedDataUrl);
    detectedIngredients = ingredients;

    if (ingredients.length === 0) {
      detectedIngredients = [];
      showIngredientsStep();
      showStatus(
        "No food detected. Try another photo, or add ingredients manually.",
        "error",
      );
    } else {
      showIngredientsStep();
      showStatus(
        `Detected ${ingredients.length} ingredient${ingredients.length === 1 ? "" : "s"}`,
        "success",
      );
    }
  } catch (err) {
    console.error("Analysis error:", err);
    analyzingStep.hidden = true;
    // Return to review so user can retake or try again
    captureReview.hidden = false;
    showStatus(err.message || "Analysis failed. Try again.", "error");
  }
}

function showIngredientsStep() {
  analyzingStep.hidden = true;
  ingredientStep.hidden = false;
  renderChips();
  addIngredientInput.value = "";
  // Don't auto-focus on mobile — screen keyboard is annoying here
  if (window.matchMedia("(min-width: 700px)").matches) {
    addIngredientInput.focus();
  }
}

// --- Ingredient chips ---
function renderChips() {
  ingredientChips.innerHTML = "";
  if (detectedIngredients.length === 0) {
    const empty = document.createElement("p");
    empty.className = "chips-empty";
    empty.textContent = "No ingredients detected. Add some below.";
    ingredientChips.appendChild(empty);
    return;
  }
  detectedIngredients.forEach((ing, idx) => {
    const chip = document.createElement("span");
    chip.className = "ingredient-chip";
    chip.innerHTML = `
      <span>${escapeChip(ing)}</span>
      <button type="button" aria-label="Remove ${escapeChip(ing)}" data-idx="${idx}">×</button>
    `;
    chip
      .querySelector("button")
      .addEventListener("click", () => removeIngredient(idx));
    ingredientChips.appendChild(chip);
  });
}

function removeIngredient(idx) {
  detectedIngredients.splice(idx, 1);
  renderChips();
}

function addIngredient(value) {
  const clean = String(value || "")
    .trim()
    .toLowerCase();
  if (!clean) return;
  if (detectedIngredients.includes(clean)) return;
  detectedIngredients.push(clean);
  renderChips();
}

function escapeChip(str) {
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

// --- Find recipes ---
function findRecipes() {
  if (detectedIngredients.length === 0) {
    showStatus("Add at least one ingredient.", "error");
    addIngredientInput.focus();
    return;
  }
  // TheMealDB searches by name — use the first ingredient as the primary search
  const primary = detectedIngredients[0];
  window.location.href = `index.html?q=${encodeURIComponent(primary)}`;
}

// --- Init ---
document.addEventListener("DOMContentLoaded", () => {
  cameraRoot = document.getElementById("camera-root");
  cameraActions = document.getElementById("camera-actions");
  captureBtn = document.getElementById("capture-btn");
  captureReview = document.getElementById("capture-review");
  capturedImg = document.getElementById("captured-img");
  retakeBtn = document.getElementById("retake-btn");
  analyzeBtn = document.getElementById("analyze-btn");
  analyzingStep = document.getElementById("analyzing-step");
  analyzingImg = document.getElementById("analyzing-img");
  ingredientStep = document.getElementById("ingredient-step");
  ingredientChips = document.getElementById("ingredient-chips");
  addIngredientInput = document.getElementById("add-ingredient-input");
  resetBtn = document.getElementById("reset-btn");
  findRecipesBtn = document.getElementById("find-recipes-btn");
  cameraStatus = document.getElementById("camera-status");

  captureBtn.addEventListener("click", capturePhoto);
  retakeBtn.addEventListener("click", retake);
  analyzeBtn.addEventListener("click", analyzePhoto);
  resetBtn.addEventListener("click", retake);
  findRecipesBtn.addEventListener("click", findRecipes);

  // Add ingredient on Enter
  addIngredientInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addIngredient(addIngredientInput.value);
      addIngredientInput.value = "";
    }
  });

  startCamera();

  window.addEventListener("beforeunload", stopStream);
});
