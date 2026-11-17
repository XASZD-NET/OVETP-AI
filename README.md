# ⚡ SCRIPT AI - Full Platform

ระบบผู้ช่วย AI สำหรับเขียนและพัฒนาสคริปต์ (Lua, Luau, Python, JS ฯลฯ) พร้อมระบบสมัครสมาชิก OTP ทางอีเมล และการปรับแต่งสีธีมหน้าเว็บอิสระ

## โครงสร้างไฟล์
- `package.json` : ไฟล์จัดการแพ็กเกจ Node.js (ตรวจสอบ JSON ถูกต้อง 100%)
- `backend/server.js` : เซิร์ฟเวอร์หลักจัดการ API แชทและระบบสมาชิก
- `backend/mailer.js` : สคริปต์เสริมสำหรับส่งอีเมล OTP พร้อมคำเตือนลิขสิทธิ์
- `frontend/index.html` : หน้าเว็บหลัก (สมัครสมาชิก, หน้าโหลด, แชท, แผงเปลี่ยนสี)
- `frontend/style.css` : สไตล์และตัวแปรควบคุมสีธีม
- `frontend/app.js` : ระบบควบคุมหน้าบ้านและการเชื่อมต่อ API

## การติดตั้งและใช้งานบน Render
1. อัปโหลดไฟล์ทั้งหมดขึ้น GitHub Repository ของคุณ
2. ตั้งค่า **Environment Variables** บน Render:
   - `GEMINI_API_KEY` : คีย์จาก Google AI Studio (`AIzaSy...`)
   - `GEMINI_MODEL` : `gemini-2.5-flash`
   - `EMAIL_USER` : อีเมล Gmail สำหรับส่ง OTP
   - `EMAIL_PASS` : รหัสผ่าน App Password 16 หลักจาก Google
3. ตั้งค่า Build Command เป็น `npm install` และ Start Command เป็น `npm start`
