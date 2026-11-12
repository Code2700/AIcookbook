/**
 * Netlify Function: analyze-image
 * Receives { image: base64DataUrl } → returns { ingredients: string[] }
 *
 * Uses Google Gemini Vision to detect food ingredients in the image.
 * Requires env var GEMINI_API_KEY (set in Netlify dashboard).
 *
 * Endpoint:
 *   POST /.netlify/functions/analyze-image
 *   Body: { "image": "data:image/jpeg;base64,..." }
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");

const MODEL = "gemini-1.5-flash"; // free tier, fast, adequate for food detection

// Prompt sent to Gemini. Being specific helps reliability.
const PROMPT = `You are analyzing a photo of a kitchen, fridge, pantry, or counter to identify food ingredients.

Instructions:
- List every visible food ingredient, raw or packaged.
- Use plain, lowercase ingredient names as you'd find in a recipe (e.g., "chicken", "rice", "garlic", "onion", "tomato").
- If you see a packaged product, use the main ingredient name (e.g., "pasta" instead of the brand name).
- Skip non-food items (utensils, containers, hands, labels without food).
- Do NOT include quantities or measurements.
- Do NOT include explanations.
- Return ONLY a JSON array of strings, nothing else.

Example valid response:
["chicken", "rice", "garlic", "onion", "tomato"]

If no food is visible, return:
[]

Now analyze the image and return the JSON array.`;

/**
 * Strip the "data:image/jpeg;base64," prefix and return { mimeType, data }.
 * Throws if the format is not recognized.
 */
function parseDataUrl(dataUrl) {
  const match = /^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    throw new Error(
      'Image must be a valid data URL (e.g., "data:image/jpeg;base64,...")',
    );
  }
  return { mimeType: match[1], data: match[2] };
}

/**
 * Extract a JSON array from a text response that may include markdown fences.
 * Gemini sometimes wraps output in ```json ... ```. We strip it.
 */
function extractJsonArray(text) {
  if (!text) return [];
  // Remove code fences if present
  let clean = text
    .replace(/```(?:json)?\s*/gi, "")
    .replace(/```/g, "")
    .trim();
  // Find the first [...] block
  const start = clean.indexOf("[");
  const end = clean.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return [];
  const slice = clean.slice(start, end + 1);
  try {
    const parsed = JSON.parse(slice);
    return Array.isArray(parsed)
      ? parsed
          .filter((x) => typeof x === "string")
          .map((s) => s.toLowerCase().trim())
          .filter(Boolean)
      : [];
  } catch (err) {
    console.warn("Could not parse Gemini response as JSON:", err.message);
    return [];
  }
}

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed. Use POST." }),
    };
  }

  // Validate env var
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[analyze-image] GEMINI_API_KEY not set");
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Server misconfigured — API key missing.",
      }),
    };
  }

  // Parse body
  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (err) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Invalid JSON body." }),
    };
  }

  if (!payload.image || typeof payload.image !== "string") {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: 'Missing "image" field (base64 data URL).',
      }),
    };
  }

  // Parse the data URL
  let imagePart;
  try {
    const { mimeType, data } = parseDataUrl(payload.image);
    imagePart = {
      inlineData: { mimeType, data },
    };
  } catch (err) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }

  // Call Gemini
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL });

    const result = await model.generateContent([PROMPT, imagePart]);
    const text = result.response.text();

    console.log("[analyze-image] Gemini raw response:", text.slice(0, 200));

    const ingredients = extractJsonArray(text);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ingredients,
        model: MODEL,
      }),
    };
  } catch (err) {
    console.error("[analyze-image] Gemini call failed:", err);

    // Detect rate limiting from Gemini's error messages
    const message = String(err.message || "").toLowerCase();
    const isQuota =
      message.includes("quota") ||
      message.includes("rate limit") ||
      message.includes("429");

    return {
      statusCode: isQuota ? 429 : 502,
      headers,
      body: JSON.stringify({
        error: isQuota
          ? "Rate limit reached. Try again in a minute."
          : "AI analysis failed. Please try again.",
      }),
    };
  }
};
