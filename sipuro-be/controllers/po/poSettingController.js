const { sipuroDb } = require('../../config/db');
const { generateNextPoNumber } = require('../../helpers/poHelper');

exports.getPoSettings = async (req, res) => {
    try {
        const [rows] = await sipuroDb.query(
            `SELECT setting_id, template_pattern, reset_cycle, description, updated_at 
             FROM sipuro_db.po_settings 
             ORDER BY setting_id DESC LIMIT 1`
        );

        const setting = rows.length > 0 ? rows[0] : {
            template_pattern: '{xxx}/PO/{customer_code}/{year}',
            reset_cycle: 'YEARLY',
            description: 'Default PO Numbering Pattern'
        };

        const { poNumber, nextSeq } = await generateNextPoNumber(sipuroDb, {
            customer_id: 1,
            customerCode: 'CUST'
        });

        res.json({
            success: true,
            data: {
                ...setting,
                next_seq: nextSeq,
                preview_po_number: poNumber
            }
        });
    } catch (error) {
        console.error('Error fetching PO settings:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch PO settings.', error: error.message });
    }
};

exports.updatePoSettings = async (req, res) => {
    try {
        const { template_pattern, reset_cycle, description, updated_by } = req.body;

        if (!template_pattern || !template_pattern.trim()) {
            return res.status(400).json({ success: false, message: 'Template pattern is required.' });
        }

        const validCycles = ['YEARLY', 'MONTHLY', 'NEVER'];
        const targetCycle = validCycles.includes(reset_cycle) ? reset_cycle : 'YEARLY';
        const cleanPattern = template_pattern.trim();

        if (!/\{(x+|sequence)\}/i.test(cleanPattern)) {
            return res.status(400).json({
                success: false,
                message: 'Template pattern must contain a sequence placeholder like {x}, {xx}, or {xxx}.'
            });
        }

        const [existingRows] = await sipuroDb.query(`SELECT setting_id FROM sipuro_db.po_settings LIMIT 1`);

        if (existingRows.length > 0) {
            await sipuroDb.query(
                `UPDATE sipuro_db.po_settings 
                 SET template_pattern = ?, reset_cycle = ?, description = ?, updated_by = ?, updated_at = NOW() 
                 WHERE setting_id = ?`,
                [cleanPattern, targetCycle, description || null, updated_by || null, existingRows[0].setting_id]
            );
        } else {
            await sipuroDb.query(
                `INSERT INTO sipuro_db.po_settings (template_pattern, reset_cycle, description, updated_by) 
                 VALUES (?, ?, ?, ?)`,
                [cleanPattern, targetCycle, description || null, updated_by || null]
            );
        }

        const { poNumber, nextSeq } = await generateNextPoNumber(sipuroDb, { customer_id: 1, customerCode: 'CUST' });

        res.json({
            success: true,
            message: 'PO Settings updated successfully!',
            data: {
                template_pattern: cleanPattern,
                reset_cycle: targetCycle,
                next_seq: nextSeq,
                preview_po_number: poNumber
            }
        });
    } catch (error) {
        console.error('Error updating PO settings:', error);
        res.status(500).json({ success: false, message: 'Failed to update PO settings.', error: error.message });
    }
};
