export async function callGeminiText(apiKey, model, prompt) {
  const m = (model || "gemini-flash-latest").trim();
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey.trim() },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `請求失敗（狀態碼 ${res.status}）`);
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
  if (!text) throw new Error("沒有收到回應內容，請稍後再試一次。");
  return text;
}

// image: { base64, mimeType } — base64 WITHOUT the "data:...;base64," prefix
export async function callGeminiVision(apiKey, model, prompt, image) {
  const m = (model || "gemini-flash-latest").trim();
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey.trim() },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: image.mimeType, data: image.base64 } },
        ],
      }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `請求失敗（狀態碼 ${res.status}）`);
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
  if (!text) throw new Error("沒有辨識出內容，請換一張清楚一點的照片試試。");
  return text;
}

// Strips ```json fences etc. and parses the first JSON object found.
export function parseJsonLoose(text) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : cleaned);
}
