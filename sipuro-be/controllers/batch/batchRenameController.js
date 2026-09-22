const { sipuroDb } = require('../../config/db');

exports.updateBatchNumber = async (req, res) => {
    const connection = await sipuroDb.getConnection();
    try {
        await connection.beginTransaction();

        const { batchId } = req.params;
        const { newBatchNumber } = req.body;

        if (!newBatchNumber || newBatchNumber.trim() === '') {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Batch number cannot be empty.'
            });
        }

        const trimmedBatchNumber = newBatchNumber.trim();

        const [[batch]] = await connection.query(`
            SELECT * FROM sipuro_db.batches 
            WHERE id = ? FOR UPDATE
        `, [batchId]);

        if (!batch) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'Batch not found.'
            });
        }

        if (batch.status !== 'Open') {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: `Batch with status "${batch.status}" cannot be renamed. Only "Open" batches can be edited.`
            });
        }

        const [[existing]] = await connection.query(`
            SELECT id FROM sipuro_db.batches 
            WHERE batch_number = ? AND id != ?
        `, [trimmedBatchNumber, batchId]);

        if (existing) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: `Batch number "${trimmedBatchNumber}" already exists. Please use a different number.`
            });
        }

        await connection.query(`
            UPDATE sipuro_db.batches 
            SET batch_number = ? 
            WHERE id = ?
        `, [trimmedBatchNumber, batchId]);

        await connection.commit();

        return res.status(200).json({
            success: true,
            message: `Batch number successfully updated to "${trimmedBatchNumber}".`
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error updateBatchNumber:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while updating batch number.',
            error: error.message
        });
    } finally {
        connection.release();
    }
};
