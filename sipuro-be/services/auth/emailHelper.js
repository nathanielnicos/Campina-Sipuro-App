const nodemailer = require('nodemailer');

const port = parseInt(process.env.SMTP_PORT, 10) || 465;
const isSecure = port === 465;

// Batas waktu pengiriman email (ms). Email ditunggu, tetapi tidak boleh menahan respons API lebih lama dari ini.
const EMAIL_TIMEOUT_MS = 5000;

const transportOptions = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: port,
    secure: isSecure,
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    connectionTimeout: EMAIL_TIMEOUT_MS,
    greetingTimeout: EMAIL_TIMEOUT_MS,
    socketTimeout: EMAIL_TIMEOUT_MS,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
};

// Verifikasi sertifikat SMTP aktif secara bawaan.
// Hanya dimatikan jika SMTP_ALLOW_SELF_SIGNED=true (untuk server SMTP dengan sertifikat tidak valid).
if (process.env.SMTP_ALLOW_SELF_SIGNED === 'true') {
    transportOptions.tls = { rejectUnauthorized: false };
}

const transporter = nodemailer.createTransport(transportOptions);

/**
 * Helper untuk mengirim email notifikasi
 * @param {string|string[]} to - Alamat email tunggal atau array berisi daftar email penerima
 * @param {string} subject - Subjek email
 * @param {string} htmlContent - Template body email (HTML)
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>} Tidak pernah melempar error.
 */
const sendEmail = async (to, subject, htmlContent) => {
    let timer;
    try {
        const mailOptions = {
            from: `"SIPURO System" <${process.env.SMTP_USER}>`,
            to,
            subject,
            html: htmlContent,
        };

        const timeout = new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(`Email timeout after ${EMAIL_TIMEOUT_MS} ms`)), EMAIL_TIMEOUT_MS);
        });

        const info = await Promise.race([transporter.sendMail(mailOptions), timeout]);
        const recipientList = Array.isArray(to) ? to.join(', ') : to;
        console.log(`Email successfully sent to [${recipientList}]: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error(`Failed to send email to ${to}:`, error);
        return { success: false, error: error.message };
    } finally {
        clearTimeout(timer);
    }
};

module.exports = { sendEmail };
