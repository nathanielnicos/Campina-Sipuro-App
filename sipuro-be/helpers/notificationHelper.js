const { sipuroDb } = require('../config/db');

/**
 * Menyimpan notifikasi baru ke database sipuro_db
 * @param {Object} params - Parameter notifikasi
 * @param {string} params.title - Judul notifikasi
 * @param {string} params.message - Isi pesan notifikasi
 * @param {'EMPLOYEE'|'CUSTOMER'} params.recipientType - Tipe penerima
 * @param {string|null} params.recipientId - ID Customer/User spesifik (null jika targetnya satu departemen)
 * @param {string|null} params.recipientDepartment - Departemen tujuan jika recipientType 'EMPLOYEE' (misal: 'PPIC')
 * @param {'EMPLOYEE'|'CUSTOMER'|null} params.senderType - Tipe pengirim
 * @param {string|null} params.senderId - ID pengirim
 * @param {string} params.link - URL tujuan saat diklik
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
    } catch (error) {
        console.error('Failed to create notification:', error);
    }
};

module.exports = { createNotification };
