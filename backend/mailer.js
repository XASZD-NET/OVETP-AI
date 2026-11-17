const nodemailer = require('nodemailer');

function createTransporter() {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        return null;
    }

    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });
}

async function sendOTPEmail(toEmail, otp) {
    const transporter = createTransporter();

    // โหมดทดสอบอัตโนมัติ หากยังไม่ได้ตั้งค่า EMAIL_USER หรือ EMAIL_PASS ใน .env
    if (!transporter) {
        console.log(`[TEST MODE] ยังไม่ได้ตั้งค่าอีเมลใน .env | OTP สำหรับ ${toEmail} คือ: ${otp}`);
        return { testMode: true };
    }

    const mailOptions = {
        from: `"Script AI Security" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: 'รหัสยืนยัน OTP สำหรับเข้าใช้งาน Script AI',
        html: `
            <div style="font-family: sans-serif; background: #0b0f19; color: #fff; padding: 25px; border-radius: 10px;">
                <h2 style="color: #38bdf8;">⚡ ยืนยันตัวตนเข้าใช้งาน Script AI</h2>
                <p>รหัส OTP 6 หลักของคุณคือ:</p>
                <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #22c55e; margin: 15px 0;">
                    ${otp}
                </div>
                <p style="color: #9ca3af; font-size: 14px;">* รหัสนี้จะหมดอายุภายใน 10 นาที</p>
                <hr style="border-color: #1f2937; margin: 20px 0;">
                <div style="background: #1f2937; padding: 15px; border-left: 4px solid #ef4444; font-size: 13px; color: #fca5a5;">
                    <strong>⚠️ คำเตือนด้านกฎหมายและทรัพย์สินทางอิเล็กทรอนิกส์:</strong><br>
                    ห้ามคัดลอก ดัดแปลง หรือนำโค้ดและระบบของเว็บไซต์ Script AI ไปใช้งานโดยไม่ได้รับอนุญาต
                </div>
            </div>
        `,
    };

    return transporter.sendMail(mailOptions);
}

module.exports = {
    sendOTPEmail,
};
