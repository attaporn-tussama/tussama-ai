// ไฟล์นี้รันบนเซิร์ฟเวอร์ของ Vercel เท่านั้น (ไม่ใช่ฝั่งเบราว์เซอร์)
// หน้าที่: รับคำขอจากหน้าเว็บ -> ถ้าเป็นแผนกที่มีข้อมูลจริง ให้ไปดึงข้อมูลมาก่อน
//         -> แนบ API key (เก็บใน Environment Variables) -> เรียก Anthropic API -> ส่งคำตอบกลับ

// ---------- ตั้งค่าแหล่งข้อมูลจริงของแต่ละแผนก ----------
// เพิ่มแผนกใหม่ได้โดยเพิ่ม key ใหม่ในนี้ พร้อมลิงก์ CSV ที่ publish จาก Google Sheet
const DATA_SOURCES = {
  sales:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQQeUdSOq0YOSz8t-dcKA5IPjlKjKU_8Qb-dfrSoUP6FJfjZ_CdM9wTPbhhSNkLNvErlrfsdujXLZh6/pub?gid=0&single=true&output=csv"
  // ตัวอย่างเพิ่มแผนกบัญชีในอนาคต:
  // accounting: "ลิงก์ CSV ของชีทบัญชี"
};

// ดึงข้อมูล CSV จริงจาก Google Sheet ของแผนกนั้นๆ
async function fetchDepartmentData(department) {
  const url = DATA_SOURCES[department];
  if (!url) return null;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error("โหลดข้อมูลแผนก " + department + " ไม่สำเร็จ: " + response.status);
      return null;
    }
    const text = await response.text();
    // กันไม่ให้ข้อมูลยาวเกินไปจนกินโควต้า token มากเกินจำเป็น
    return text.slice(0, 4000);
  } catch (err) {
    console.error("โหลดข้อมูลแผนก " + department + " ไม่สำเร็จ:", err);
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "ใช้ได้เฉพาะ POST เท่านั้น" });
    return;
  }

  const { system, message, department } = req.body || {};

  if (!message) {
    res.status(400).json({ error: "ไม่พบข้อความที่จะส่งให้ Claude" });
    return;
  }

  let finalSystem = system || "";

  // ถ้าแผนกนี้มีข้อมูลจริงตั้งค่าไว้ ให้ดึงมาแปะต่อท้าย system prompt
  if (department) {
    const csvData = await fetchDepartmentData(department);
    if (csvData) {
      finalSystem +=
        "\n\nนี่คือข้อมูลจริงล่าสุดของแผนกนี้ (รูปแบบ CSV จาก Google Sheet) " +
        "ให้ใช้ข้อมูลนี้ประกอบการตอบ ห้ามกุดตัวเลขขึ้นเอง:\n" +
        csvData;
    }
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
        system: finalSystem,
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
