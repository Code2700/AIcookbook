/**
 * Frontend wrapper for the analyze-image Netlify function.
 * Depends on nothing.
 *
 * Public API:
 *   analyzeImage(base64DataUrl) → Promise<string[]>
 *     Resolves with array of detected ingredient strings (may be empty).
 *     Rejects with an Error whose message is safe to show to the user.
 */

const AI_VISION_ENDPOINT = "/.netlify/functions/analyze-image";

/**
 * @param {string} base64DataUrl — full data URL like "data:image/jpeg;base64,..."
 * @returns {Promise<string[]>}
 */
async function analyzeImage(base64DataUrl) {
  if (!base64DataUrl || typeof base64DataUrl !== "string") {
    throw new Error("No image provided.");
  }

  let response;
  try {
    response = await fetch(AI_VISION_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: base64DataUrl }),
    });
  } catch (err) {
    console.error("analyzeImage network error:", err);
    throw new Error(
      "Could not reach the analysis service. Check your connection.",
    );
  }

  // Rate limit has a special message
  if (response.status === 429) {
    throw new Error(
      "Too many requests right now. Wait a minute and try again.",
    );
  }

  let data;
  try {
    data = await response.json();
  } catch (err) {
    throw new Error("Analysis service returned an invalid response.");
  }

  if (!response.ok) {
    throw new Error(data?.error || "Analysis failed. Please try again.");
  }

  return Array.isArray(data.ingredients) ? data.ingredients : [];
}
