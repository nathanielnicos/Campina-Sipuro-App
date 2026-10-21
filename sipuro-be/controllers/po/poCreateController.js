const { sipuroDb } = require('../../config/db');
const { createNotification } = require('../../helpers/notificationHelper');
const { safeError } = require('../../helpers/safeError');
const { createPurchaseOrder, findCustomer, getCurrentPpnPercent } = require('../../services/poCreateService');

// Status awal yang boleh dikirim klien saat membuat PO.
const ALLOWED_CREATE_STATUSES = ['Draft', 'Waiting for Confirmation'];

/**
 * CREATE PO
 */
exports.createPO = async (req, res) => {
    const connection = await sipuroDb.getConnection();
    try {
        const { delivery_address, description, items, status } = req.body;
        // Identitas diambil dari token login, bukan dari body request.
        const customer_id = req.user.customerId;
        const created_by = req.user.id;

        if (!customer_id || !items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Incomplete request data.' });
        }

        const targetStatus = (status === undefined || status === null || status === '') ? 'Waiting for Confirmation' : status;
        if (!ALLOWED_CREATE_STATUSES.includes(targetStatus)) {
            return res.status(400).json({ success: false, message: 'Invalid PO status.' });
        }
        const safeDescription = description ? description.trim().slice(0, 50) : null;

        const customer = await findCustomer(sipuroDb, customer_id);
        const customerName = customer ? customer.company_name : 'Customer';
        const customerCode = (customer && customer.customer_code) ? customer.customer_code : 'CUST';

        const ppn_percent = await getCurrentPpnPercent(sipuroDb);

        const { poHeaderId, poNumber } = await createPurchaseOrder(connection, {
            customerId: customer_id,
            customerCode,
            items,
            ppnPercent: ppn_percent,
            status: targetStatus,
            deliveryAddress: delivery_address,
            description: safeDescription,
            createdBy: created_by,
            suggestedBy: null,
            logActionType: 'CREATE',
            logActionBy: created_by || customer_id
        });

        if (targetStatus !== 'Draft') {
            await createNotification({
                title: 'New PO Received',
                message: `${poNumber} has been created by ${customerName}.`,
                recipientType: 'EMPLOYEE',
                recipientDepartment: 'PPIC',
                senderType: 'CUSTOMER',
                senderId: customer_id,
                link: '/po?search=' + encodeURIComponent(poNumber)
            });
        }

        res.json({ success: true, message: 'Purchase Order created successfully!', data: { po_header_id: poHeaderId, po_number: poNumber } });
    } catch (error) {
        await connection.rollback();
        if (error && error.isValidation) {
            return res.status(400).json({ success: false, message: error.message });
        }
        console.error('Error creating PO:', error);
        res.status(500).json({ success: false, message: 'Failed to create Purchase Order.', error: safeError(error) });
    } finally {
        connection.release();
    }
};
