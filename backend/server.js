require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const { GoogleGenAI } = require('@google/genai');
const { sendOTPEmail } = require('./mailer');

const app = express();
app.use(cors());
app.use(express.json());

// ตั้งค่า Gemini AI SDK
if (!process.env.GEMINI_API_KEY) {
    console.warn('⚠️ คำเตือน: ยังไม่ได้ตั้งค่า GEMINI_API_KEY ในไฟล์ .env');
}
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

// เก็บข้อมูลชั่วคราวในหน่วยความจำ
const otpStore = new Map();     // key: normalizedEmail -> { otp, expiresAt, verified }
const usersStore = new Map();   // key: normalizedEmail -> { username, passwordHash, createdAt }

const OTP_TTL_MS = 10 * 60 * 1000; // 10 นาที

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
}

function generateOtp() {
    return crypto.randomInt(100000, 999999).toString();
}

// 1. API ส่งรหัส OTP (เรียกผ่าน ./mailer.js)
app.post('/api/send-otp', async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'กรุณากรอกอีเมลให้ถูกต้อง' });
    }

    const otp = generateOtp();
    const expiresAt = Date.now() + OTP_TTL_MS;

    otpStore.set(email, { otp, expiresAt, verified: false });

    try {
        await sendOTPEmail(email, otp);
        return res.json({
            success: true,
            message: 'ส่งรหัส OTP ไปยังอีเมลของคุณเรียบร้อยแล้ว (โปรดตรวจสอบภายใน 1 นาที)',
        });
    } catch (error) {
        console.error('Send OTP Error:', error);
        return res.status(500).json({
            error: 'ไม่สามารถส่งอีเมล OTP ได้ กรุณาตรวจสอบการตั้งค่าระบบอีเมล',
        });
    }
});

// 2. API ตรวจสอบรหัส OTP
app.post('/api/verify-otp', (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const otp = String(req.body?.otp || '').trim();
    const record = otpStore.get(email);

    if (!record) {
        return res.status(400).json({ error: 'ไม่พบข้อมูลการขอ OTP สำหรับอีเมลนี้' });
    }
    if (Date.now() > record.expiresAt) {
        otpStore.delete(email);
        return res.status(400).json({ error: 'รหัส OTP หมดอายุแล้ว กรุณากดขอรหัสใหม่' });
    }
    if (!otp || record.otp !== otp) {
        return res.status(400).json({ error: 'รหัส OTP ไม่ถูกต้อง' });
    }

    record.verified = true;
    otpStore.set(email, record);

    return res.json({ success: true, message: 'ยืนยัน OTP สำเร็จ!' });
});

// 3. API บันทึกการสมัครสมาชิก
app.post('/api/register', (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');
    const consent1 = Boolean(req.body?.consent1);
    const consent2 = Boolean(req.body?.consent2);

    if (!email || !username || !password) {
        return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบทุกช่อง' });
    }
    if (password.length < 8 || password.length > 12) {
        return res.status(400).json({ error: 'รหัสผ่านต้องมีความยาว 8 ถึง 12 หลักเท่านั้น' });
    }
    if (!consent1 || !consent2) {
        return res.status(400).json({ error: 'กรุณากดยินยอมเงื่อนไขทั้ง 2 ข้อก่อนดำเนินการต่อ' });
    }

    const otpRecord = otpStore.get(email);
    if (!otpRecord || !otpRecord.verified || Date.now() > otpRecord.expiresAt) {
        return res.status(400).json({ error: 'กรุณายืนยันรหัส OTP ให้เสร็จสิ้นก่อนสมัครสมาชิก' });
    }

    if (usersStore.has(email)) {
        return res.status(409).json({ error: 'อีเมลนี้ถูกใช้งานสมัครสมาชิกไปแล้ว' });
    }

    usersStore.set(email, {
        username,
        passwordHash: hashPassword(password),
        createdAt: new Date().toISOString(),
    });
    otpStore.delete(email);

    return res.json({
        success: true,
        username,
        message: 'สมัครสมาชิกสำเร็จ',
    });
});

// 4. API แชทกับ Script AI
app.post('/api/chat', async (req, res) => {
    try {
        const message = String(req.body?.message || '').trim();
        const confirmed = Boolean(req.body?.confirmed);

        if (!message) {
            return res.status(400).json({ error: 'กรุณาส่งข้อความ' });
        }

        const systemInstruction = `คุณคือ "Script AI" ผู้ช่วยเขียนโค้ดและพัฒนาสคริปต์ระดับสูง
กฎการทำงานของคุณ:
1. คุณเชี่ยวชาญการเขียนโค้ดทุกภาษา โดยเฉพาะ Lua, Luau (Roblox), Python, JavaScript, HTML/CSS และสามารถเขียนโค้ดผสมผสานโครงสร้างข้ามภาษาได้อย่างยืดหยุ่น
2. หากผู้ใช้สั่งให้ "สร้าง" หรือ "เขียนสคริปต์" หรือ "ทำระบบ" และสถานะการยืนยัน (confirmed) ยังเป็น false:
   - ห้ามสร้างโค้ดฉบับเต็มทันที!
   - ให้วิเคราะห์ความต้องการ ถามคำถามเพิ่มเติมสั้นๆ เพื่อความชัดเจน และจบประโยคด้วยคำถามบังคับว่า: "คุณต้องการให้เริ่มทำหรือสร้างเลยหรือไม่?"
3. หากสถานะการยืนยัน (confirmed) เป็น true หรือผู้ใช้กดยืนยันให้เริ่มสร้างแล้ว:
   - ให้ลงมือเขียนโค้ดหรือสร้างสคริปต์ฉบับสมบูรณ์อย่างละเอียดและใช้งานได้จริงทันที!`;

        const promptContent = confirmed
            ? `[ผู้ใช้กดยืนยันให้เริ่มสร้างแล้ว] คำสั่งเดิม: ${message}`
            : message;

        const response = await ai.models.generateContent({
            model: modelName,
            contents: promptContent,
            config: {
                systemInstruction,
            },
        });

        const reply = response.text || 'ขออภัยครับ ไม่สามารถประมวลผลคำตอบได้ในขณะนี้';
        const askConfirmation =
            !confirmed &&
            /คุณต้องการให้เริ่มทำหรือสร้างเลยหรือไม่\??/i.test(reply);

        return res.json({ reply, askConfirmation });
    } catch (error) {
        console.error('Gemini API Error:', error);
        return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการติดต่อกับ AI' });
    }
});

// เสิร์ฟไฟล์หน้าบ้าน (Frontend)
app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`SCRIPT AI OS running on port ${PORT}`);
});
