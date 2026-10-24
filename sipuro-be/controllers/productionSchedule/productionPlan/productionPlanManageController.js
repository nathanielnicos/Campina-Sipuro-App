const { sipuroDb } = require('../../../config/db');
const { getWibDateTimeString } = require('../../../helpers/dateHelper');
const { BusinessError, sendControllerError } = require('../../../helpers/businessError');
const { validateSavePayload } = require('../../../helpers/productionPlanValidation');

/**
 * Menyimpan Production Plan & revisinya dari modal detail.
 *
 * Aturan:
 * - Hanya minggu pada rentang yang tampil (start_week..end_week) yang ditulis (upsert); minggu lain tidak disentuh.
 * - Tidak ada revisi atau item yang dihapus. Revisi lama dicocokkan lewat id_revision; yang tidak punya id dibuat baru.
 * - Revisi lama hanya diubah qty-nya; tipe, label, tanggal, dan pembuat aslinya dipertahankan.
 * - Aktor (created_by / updated_by) selalu dari token, bukan dari body.
 * - Tepat satu CAMPINA_PLAN per produk.
 */
exports.saveProductionPlan = async (req, res) => {
    let connection;
    try {
        const employeeId = req.user && req.user.id;
        if (!employeeId) throw new BusinessError('Unauthorized.', 401);

        const { idProduct, revisions } = validateSavePayload(req.body);

        connection = await sipuroDb.getConnection();

        const [prodRows] = await connection.query(
            'SELECT id_product FROM sipuro_db.products WHERE id_product = ?',
            [idProduct]
        );
        if (prodRows.length === 0) throw new BusinessError('Product not found.', 404);

        await connection.beginTransaction();

        // Buat plan jika belum ada (aman terhadap dua simpan bersamaan), lalu kunci barisnya.
        await connection.query(
            'INSERT IGNORE INTO sipuro_db.production_plans (id_product, created_by, updated_by) VALUES (?, ?, ?)',
            [idProduct, employeeId, employeeId]
        );
        const [planRows] = await connection.query(
            'SELECT id_plan FROM sipuro_db.production_plans WHERE id_product = ? FOR UPDATE',
            [idProduct]
        );
        const idPlan = planRows[0].id_plan;

        await connection.query(
            'UPDATE sipuro_db.production_plans SET updated_at = ?, updated_by = ? WHERE id_plan = ?',
            [getWibDateTimeString(), employeeId, idPlan]
        );

        const [existing] = await connection.query(
            'SELECT id_revision, revision_type FROM sipuro_db.production_plan_revisions WHERE id_plan = ?',
            [idPlan]
        );
        const existingById = new Map(existing.map((r) => [r.id_revision, r.revision_type]));

        let finalCampinaCount = existing.filter((r) => r.revision_type === 'CAMPINA_PLAN').length;

        for (const rev of revisions) {
            if (rev.idRevision) {
                if (!existingById.has(rev.idRevision)) {
                    throw new BusinessError('This plan has changed. Please reload and try again.', 409);
                }
                if (existingById.get(rev.idRevision) !== rev.type) {
                    throw new BusinessError('Revision type cannot be changed.', 400);
                }
            } else if (rev.type === 'CAMPINA_PLAN') {
                finalCampinaCount += 1;
            }
        }
        if (finalCampinaCount !== 1) {
            throw new BusinessError("This plan has changed. Please reload and try again.", 409);
        }

        for (const rev of revisions) {
            let idRevision = rev.idRevision;

            if (!idRevision) {
                const [inserted] = await connection.query(
                    `INSERT INTO sipuro_db.production_plan_revisions
                     (id_plan, revision_type, revision_label, revision_date, created_by)
                     VALUES (?, ?, ?, ?, ?)`,
                    [idPlan, rev.type, rev.label, rev.date, employeeId]
                );
                idRevision = inserted.insertId;
            }

            const rows = rev.items.map((it) => [idRevision, it.year, it.week_number, it.week_start_date, it.qty]);
            await connection.query(
                `INSERT INTO sipuro_db.production_plan_items
                 (id_revision, year, week_number, week_start_date, qty)
                 VALUES ?
                 ON DUPLICATE KEY UPDATE qty = VALUES(qty), week_start_date = VALUES(week_start_date)`,
                [rows]
            );
        }

        await connection.commit();
        res.json({ success: true, message: 'Production Plan successfully saved.' });
    } catch (error) {
        if (connection) {
            try { await connection.rollback(); } catch (rollbackError) { /* koneksi sudah putus */ }
        }
        sendControllerError(res, error, { label: 'Error saveProductionPlan', fallbackMessage: 'Failed to save Production Plan.' });
    } finally {
        if (connection) connection.release();
    }
};
