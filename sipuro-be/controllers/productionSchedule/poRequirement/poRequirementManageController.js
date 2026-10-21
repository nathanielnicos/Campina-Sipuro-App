const { sipuroDb } = require('../../../config/db');
const { createNotification } = require('../../../helpers/notificationHelper');
const { safeError } = require('../../../helpers/safeError');
const { createPurchaseOrder, findCustomer, getCurrentPpnPercent } = require('../../../services/poCreateService');

/**
 * CREATE DRAFT PO FROM PO REQUIREMENT BY PPIC
 * Pelaku PPIC dibaca dari token login, bukan dari body request. PO dibuat atas nama
 * customer tanpa pembuat (created_by kosong); PPIC pemberi saran dicatat di suggested_by.
 */
exports.createDraftPO = async (req, res) => {
    const connection = await sipuroDb.getConnection();
    try {
        const { customer_id, items, description } = req.body;
        const employeeId = req.user.id;

        const customerId = Number(customer_id);
        if (!Number.isInteger(customerId) || customerId <= 0 || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Customer and items are required.' });
        }
        if (description !== undefined && description !== null && typeof description !== 'string') {
            return res.status(400).json({ success: false, message: 'Description must be text.' });
        }
        const safeDescription = description ? description.trim().slice(0, 50) || null : null;

        const customer = await findCustomer(sipuroDb, customerId);
        if (!customer || !customer.is_active) {
            return res.status(404).json({ success: false, message: 'Customer not found.' });
        }

        // Layar mengirim jumlah di required_po_qty; harga selalu dihitung server.
        const lines = items.map((item) => ({
            id_product: item && item.id_product,
            qty: item && item.required_po_qty
        }));

        const ppnPercent = await getCurrentPpnPercent(sipuroDb);

        const { poHeaderId, poNumber } = await createPurchaseOrder(connection, {
            customerId,
            customerCode: customer.customer_code || 'CUST',
            items: lines,
            ppnPercent,
            status: 'Draft',
            deliveryAddress: customer.delivery_address || '',
            description: safeDescription,
            createdBy: null,
            suggestedBy: employeeId,
            logActionType: 'SUGGEST_CREATE',
            logActionBy: employeeId
        });

        await createNotification({
            title: 'Suggested Draft PO Created',
            message: `A new suggested Draft PO ${poNumber} has been created for your review by PPIC.`,
            recipientType: 'CUSTOMER',
            recipientId: customerId,
            senderType: 'EMPLOYEE',
            senderId: employeeId,
            link: '/po-list?search=' + encodeURIComponent(poNumber)
        });

        res.json({
            success: true,
            message: `Draft PO ${poNumber} successfully created!`,
            data: { po_header_id: poHeaderId, po_number: poNumber }
        });
    } catch (error) {
        await connection.rollback();
        if (error && error.isValidation) {
            return res.status(400).json({ success: false, message: error.message });
        }
        console.error('Error creating Draft PO:', error);
        res.status(500).json({ success: false, message: 'Failed to create Draft PO.', error: safeError(error) });
    } finally {
        connection.release();
    }
};
