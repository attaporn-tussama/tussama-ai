// ไฟล์นี้รันบนเซิร์ฟเวอร์ของ Vercel เท่านั้น (ไม่ใช่ฝั่งเบราว์เซอร์)
// หน้าที่: รับคำขอจากหน้าเว็บ -> ดึงข้อมูลจริงจากทุกแผนกที่ตั้งค่าไว้พร้อมกัน
//         -> แนบให้ Claude เห็นทั้งหมด -> แนบ API key -> เรียก Anthropic API -> ส่งคำตอบกลับ
//
// จุดสำคัญของเวอร์ชันนี้: ทุกแผนกจะ "เห็นข้อมูลของกันและกัน" เสมอ
// เช่น ตอนคุยกับแผนกบัญชี จะเห็นทั้งข้อมูลบัญชี + ข้อมูลยอดขาย + ข้อมูลผู้ผลิตไปพร้อมกัน
// ทำให้คำนวณเรื่องที่ต้องใช้ข้อมูลข้ามแผนก (เช่น กำไรสุทธิ) ได้โดยไม่ต้องกรอกซ้ำ

// ---------- ตั้งค่าแหล่งข้อมูลจริงของแต่ละแผนก ----------
// เพิ่มแผนกใหม่ได้โดยเพิ่ม key ใหม่ในนี้ พร้อม label และลิงก์ CSV ที่ publish จาก Google Sheet
const DATA_SOURCES = {
  sales: {
    label: "ขาย/จำหน่าย",
    url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQQeUdSOq0YOSz8t-dcKA5IPjlKjKU_8Qb-dfrSoUP6FJfjZ_CdM9wTPbhhSNkLNvErlrfsdujXLZh6/pub?gid=0&single=true&output=csv"
  },
  accounting: {
    label: "บัญชี/การเงิน",
    url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQQeUdSOq0YOSz8t-dcKA5IPjlKjKU_8Qb-dfrSoUP6FJfjZ_CdM9wTPbhhSNkLNvErlrfsdujXLZh6/pub?gid=1337484610&single=true&output=csv"
  },
  manufacturing: {
    label: "ประสานผู้ผลิต",
    url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQQeUdSOq0YOSz8t-dcKA5IPjlKjKU_8Qb-dfrSoUP6FJfjZ_CdM9wTPbhhSNkLNvErlrfsdujXLZh6/pub?gid=541678466&single=true&output=csv"
  }
  // เพิ่มแผนกถัดไปในรูปแบบเดียวกันนี้ได้เลย เช่น:
  // customerService: { label: "บริการลูกค้า", url: "ลิงก์ CSV" }
};

// ดึงข้อมูล CSV จริงจากทุกแผนกพร้อมกัน (ยิงพร้อมกันด้วย Promise.all ไม่ต้องรอทีละอัน)
async function fetchAllDepartmentData() {
  const entries = Object.entries(DATA_SOURCES);

  const results = await Promise.all(
    entries.map(async ([key, info]) => {
      try {
        const response = await fetch(info.url);
        if (!response.ok) {
          console.error("โหลดข้อมูลแผนก " + key + " ไม่สำเร็จ: " + response.status);
          return null;
        }
        const text = await response.text();
        // กันไม่ให้ข้อมูลแต่ละแผนกยาวเกินไปจนกินโควต้า token มากเกินจำเป็น
        return { key, label: info.label, text: text.slice(0, 3000) };
      } catch (err) {
        console.error("โหลดข้อมูลแผนก " + key + " ไม่สำเร็จ:", err);
        return null;
      }
    })
  );

  return results.filter(Boolean);
}

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

  let finalSystem = system || "";

  const allData = await fetchAllDepartmentData();
  if (allData.length > 0) {
    const combined = allData
      .map((d) => `[ข้อมูลจริงแผนก ${d.label}]\n${d.text}`)
      .join("\n\n");

    finalSystem +=
      "\n\nนี่คือข้อมูลจริงล่าสุดของทุกแผนก (รูปแบบ CSV จาก Google Sheet) " +
      "ใช้เฉพาะส่วนที่เกี่ยวข้องกับคำถามในการตอบ ห้ามกุดตัวเลขขึ้นเอง " +
      "ถ้าต้องคำนวณอะไรที่ต้องใช้ข้อมูลข้ามแผนก (เช่น กำไรสุทธิ) ให้ใช้ข้อมูลจากทุกแผนกที่เกี่ยวข้องได้เลย:\n\n" +
      combined;
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
