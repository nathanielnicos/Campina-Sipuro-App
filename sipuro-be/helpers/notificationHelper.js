const { sipuroDb } = require('../config/db');
const { sendEmail } = require('./emailHelper');

/**
 * Saves a new notification to sipuro_db and dispatches email notifications.
 * 
 * @param {Object} params
 * @param {string} params.title - Notification title
 * @param {string} params.message - Notification body content
 * @param {'EMPLOYEE'|'CUSTOMER'} params.recipientType - Target recipient entity
 * @param {string|number|null} params.recipientId - Specific Customer User ID / Employee ID (null if targeting department)
 * @param {string|null} params.recipientDepartment - Target department if recipientType is 'EMPLOYEE' (e.g., 'PPIC')
 * @param {'EMPLOYEE'|'CUSTOMER'|null} params.senderType - Sender entity type
 * @param {string|number|null} params.senderId - Sender User ID
 * @param {string} params.link - Target URL path upon click
 */
const createNotification = async ({
    title,
    message,
    recipientType,
    recipientId = null,
    recipientDepartment = null,
    senderType = null,
    senderId = null,
    link = '/po-list'
}) => {
    try {
        // 1. Insert notification record into database
        const query = `
            INSERT INTO sipuro_db.notifications 
            (title, message, recipient_type, recipient_id, recipient_department, sender_type, sender_id, link)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        await sipuroDb.query(query, [
            title,
            message,
            recipientType,
            recipientId,
            recipientDepartment,
            senderType,
            senderId,
            link
        ]);

        // 2. Fetch recipient email addresses
        let recipientEmails = [];

        if (recipientType === 'CUSTOMER' && recipientId) {
            // Query using customer_user_id primary key from customer_users table
            const [custRows] = await sipuroDb.query(
                `SELECT email FROM sipuro_db.customer_users WHERE customer_user_id = ? AND email IS NOT NULL AND email != '' AND is_active = 1`,
                [recipientId]
            );
            recipientEmails = custRows.map(row => row.email);
        } else if (recipientType === 'EMPLOYEE') {
            let empQuery = `SELECT email FROM sipuro_db.employees WHERE email IS NOT NULL AND email != '' AND is_suspended = 0`;
            let empParams = [];

            if (recipientId) {
                // Query using id primary key from employees table
                empQuery += ` AND id = ?`;
                empParams.push(recipientId);
            } else if (recipientDepartment) {
                // Target all active employees in department (e.g., 'PPIC')
                empQuery += ` AND department = ?`;
                empParams.push(recipientDepartment);
            }

            const [empRows] = await sipuroDb.query(empQuery, empParams);
            recipientEmails = empRows.map(row => row.email);
        }

        // 3. Dispatch batch email notification
        if (recipientEmails.length > 0) {
            const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
            const fullLink = `${baseUrl}${link.startsWith('/') ? link : '/' + link}`;

            const emailSubject = `[SIPURO Notification] ${title}`;
            const htmlContent = `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #0056b3; margin-top: 0;">${title}</h2>
                    <p style="font-size: 15px; line-height: 1.6; color: #444;">${message}</p>
                    
                    <div style="margin: 25px 0;">
                        <a href="${fullLink}" target="_blank" style="background-color: #0056b3; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                            View in SIPURO System
                        </a>
                    </div>

                    <p style="font-size: 13px; color: #666;">
                        If the button above doesn't work, copy and paste the following URL into your browser:<br/>
                        <a href="${fullLink}" style="color: #0056b3;">${fullLink}</a>
                    </p>

                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #888;">
                        This is an automated message sent by SIPURO System. Please do not reply to this email.
                    </p>
                </div>
            `;

            await sendEmail(recipientEmails, emailSubject, htmlContent);
        }
    } catch (error) {
        console.error('Failed to create notification or send email:', error);
    }
};

module.exports = { createNotification };
