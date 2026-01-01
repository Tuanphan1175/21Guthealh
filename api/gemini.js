// api/gemini.js

export default async function handler(req, res) {
  // --- CORS ---
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,OPTIONS,PATCH,DELETE,POST,PUT"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
  );

  // Preflight
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  // Chỉ cho POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // Lấy API key từ Vercel Env
  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({
      error: "Missing GEMINI_API_KEY on server. Add it in Vercel → Project → Settings → Environment Variables.",
    });
  }

  try {
    const { prompt, model } = req.body || {};
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Missing 'prompt' (string) in request body." });
    }

    const MODEL_NAME = model || "gemini-2.5-flash";
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        // Nếu muốn ép JSON output, bật dòng dưới:
        // generationConfig: { responseMimeType: "application/json" }
      }),
    });

    const data = await response.json();

    // Nếu Gemini trả lỗi/quota
    if (!response.ok) {
      return res.status(response.status).json({
        error: "Gemini API error",
        status: response.status,
        details: data,
      });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error("Gemini backend error:", err);
    return res.status(500).json({ error: "Gemini backend error" });
  }
}
