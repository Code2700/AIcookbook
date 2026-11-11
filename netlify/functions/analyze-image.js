/**
 * Netlify Function: analyze-image
 * Receives { image: base64String } → returns { ingredients: string[] }
 *
 * M4b: STUB implementation. Returns fake data so we can verify deployment works.
 * M4c: Replaced with real Gemini Vision API call.
 *
 * Endpoint:
 *   POST /.netlify/functions/analyze-image
 *   Body: { "image": "data:image/jpeg;base64,..." }
 */

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  // Only allow POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed. Use POST." }),
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

  // --- STUB: return fake ingredients for now ---
  // M4c will replace this with a real Gemini Vision call.
  console.log("[analyze-image] received image, length:", payload.image.length);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      ingredients: ["chicken", "rice", "garlic", "onion"],
      stub: true,
      note: "M4b stub — real Gemini Vision in M4c",
    }),
  };
};
