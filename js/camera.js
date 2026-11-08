/**
 * Camera preview + photo capture.
 * M4a: manual ingredient entry. M4d will replace the text input with AI detection.
 */

let stream = null;
let videoEl = null;
let canvasEl = null;
let capturedDataUrl = null;

// --- DOM refs ---
let cameraRoot;
let cameraActions;
let captureBtn;
let captureReview;
let capturedImg;
let retakeBtn;
let useBtn;
let ingredientStep;
let ingredientsInput;
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

    // Hidden canvas for capturing frames
    canvasEl = document.createElement("canvas");
    canvasEl.style.display = "none";
    cameraRoot.appendChild(canvasEl);

    await videoEl.play();

    cameraActions.hidden = false;
    captureReview.hidden = true;
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

  // Use video's native dimensions
  canvasEl.width = videoEl.videoWidth;
  canvasEl.height = videoEl.videoHeight;
  const ctx = canvasEl.getContext("2d");
  ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);

  // JPEG at quality 0.85 — good balance for AI analysis
  capturedDataUrl = canvasEl.toDataURL("image/jpeg", 0.85);

  // Show captured image for review
  capturedImg.src = capturedDataUrl;
  captureReview.hidden = false;
  cameraActions.hidden = true;

  // Stop the live stream while reviewing (saves battery, frees camera)
  stopStream();
  showStatus("Photo captured. Retake or use it to find recipes.", "success");
}

function retake() {
  capturedDataUrl = null;
  capturedImg.src = "";
  captureReview.hidden = true;
  ingredientStep.hidden = true;
  startCamera();
}

function useCapturedPhoto() {
  if (!capturedDataUrl) return;
  captureReview.hidden = true;
  ingredientStep.hidden = false;
  showStatus("", "info");
  ingredientsInput.focus();
}

// --- Find recipes from ingredients ---
function findRecipes() {
  const raw = ingredientsInput.value.trim();
  if (!raw) {
    showStatus("Type at least one ingredient.", "error");
    ingredientsInput.focus();
    return;
  }

  // Take the first ingredient as the primary search term
  // (TheMealDB searches by name — multi-ingredient search isn't native)
  const firstIngredient = raw.split(",")[0].trim();
  if (!firstIngredient) {
    showStatus("Type at least one ingredient.", "error");
    return;
  }

  // Navigate to home page with search query in URL
  // search.js will read ?q= and run the search on load
  window.location.href = `index.html?q=${encodeURIComponent(firstIngredient)}`;
}

// --- Init ---
document.addEventListener("DOMContentLoaded", () => {
  cameraRoot = document.getElementById("camera-root");
  cameraActions = document.getElementById("camera-actions");
  captureBtn = document.getElementById("capture-btn");
  captureReview = document.getElementById("capture-review");
  capturedImg = document.getElementById("captured-img");
  retakeBtn = document.getElementById("retake-btn");
  useBtn = document.getElementById("use-btn");
  ingredientStep = document.getElementById("ingredient-step");
  ingredientsInput = document.getElementById("ingredients-input");
  findRecipesBtn = document.getElementById("find-recipes-btn");
  cameraStatus = document.getElementById("camera-status");

  captureBtn.addEventListener("click", capturePhoto);
  retakeBtn.addEventListener("click", retake);
  useBtn.addEventListener("click", useCapturedPhoto);
  findRecipesBtn.addEventListener("click", findRecipes);

  startCamera();

  // Clean up stream on page unload
  window.addEventListener("beforeunload", stopStream);
});
