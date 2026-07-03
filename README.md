# เลขา AI — TUSSAMA

ระบบเลขา AI ที่รับคำสั่งจากเจ้าของบริษัท แล้วกระจายงานไปให้แผนกต่างๆ
(วิจัยตลาด, ประสานผู้ผลิต, ขาย, การตลาด, ครีเอทีฟ, บริการลูกค้า, บัญชี)
ก่อนสรุปเป็นคำตอบเดียว

## โครงสร้างไฟล์
- `index.html` — หน้าเว็บแชท (ฝั่งผู้ใช้)
- `api/chat.js` — serverless function ที่เก็บ API key และเรียก Anthropic API แทนเรา
- `package.json` — ไฟล์ตั้งค่าโปรเจกต์

## วิธี deploy บน Vercel

1. สร้าง repository ใหม่บน GitHub แล้วอัปโหลดไฟล์ทั้งหมดในโฟลเดอร์นี้ขึ้นไป
2. ไปที่ vercel.com → "Add New Project" → เลือก repository ที่เพิ่งสร้าง
3. ก่อนกด Deploy ให้ไปที่ "Environment Variables" แล้วเพิ่ม:
   - Name: `ANTHROPIC_API_KEY`
   - Value: (API key จาก console.anthropic.com)
4. กด Deploy รอสักครู่ จะได้ลิงก์เว็บ เช่น `tussama-ai.vercel.app`
5. เปิดลิงก์แล้วทดลองพิมพ์คุยกับเลขาได้เลย

## วิธีปรับแต่งต่อ
- แก้ไข system prompt ของแต่ละแผนกได้ในไฟล์ `index.html` ที่ตัวแปร `DEPARTMENTS`
- เพิ่มแผนกใหม่ได้โดยเพิ่ม key ใหม่ใน `DEPARTMENTS` object
