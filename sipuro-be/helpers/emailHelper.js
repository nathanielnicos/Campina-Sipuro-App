const nodemailer = require('nodemailer');

const port = parseInt(process.env.SMTP_PORT, 10) || 465;
const isSecure = port === 465;

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: port,
    secure: isSecure,
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
    tls: {
        rejectUnauthorized: false
    }
});

/**
 * Helper untuk mengirim email notifikasi
 * @param {string|string[]} to - Alamat email tunggal atau array berisi daftar email penerima
 * @param {string} subject - Subjek email
 * @param {string} htmlContent - Template body email (HTML)
 */
const sendEmail = async (to, subject, htmlContent) => {
    try {
        const mailOptions = {
            from: `"SIPURO System" <${process.env.SMTP_USER}>`,
            to,
            subject,
            html: htmlContent,
        };

        const info = await transporter.sendMail(mailOptions);
        const recipientList = Array.isArray(to) ? to.join(', ') : to;
        console.log(`Email successfully sent to [${recipientList}]: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error(`Failed to send email to ${to}:`, error);
        return { success: false, error: error.message };
    }
};

module.exports = { sendEmail };
