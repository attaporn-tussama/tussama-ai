// ไฟล์นี้รันบนเซิร์ฟเวอร์ของ Vercel เท่านั้น (ไม่ใช่ฝั่งเบราว์เซอร์)
// หน้าที่: รับคำขอจากหน้าเว็บ -> แนบ API key (ที่เก็บไว้ใน Environment Variables) -> เรียก Anthropic API -> ส่งคำตอบกลับ
// ข้อดี: API key ไม่หลุดออกไปในโค้ดฝั่งเบราว์เซอร์เลย

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "ใช้ได้เฉพาะ POST เท่านั้น" });
    return;
  }

  const { system, message } = req.body || {};

  if (!message) {
    res.status(400).json({ error: "ไม่พบข้อความที่จะส่งให้ Claude" });
    return;
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system: system || "",
        messages: [{ role: "user", content: message }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      res.status(response.status).json({ error: "Anthropic API error: " + errText });
      return;
    }

    const data = await response.json();
    const textBlock = (data.content || []).find((block) => block.type === "text");
    res.status(200).json({ text: textBlock ? textBlock.text : "" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
