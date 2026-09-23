const { sipuroDb } = require('../../../config/db');

/**
 * Menyimpan / Meng-update Production Plan & Revisions dari Modal Detail
 */
exports.saveProductionPlan = async (req, res) => {
    const connection = await sipuroDb.getConnection();
    try {
        const { id_product, revisions, weeks, created_by } = req.body;

        if (!id_product || !Array.isArray(revisions) || revisions.length === 0) {
            return res.status(400).json({ success: false, message: 'Invalid plan revision data.' });
        }

        await connection.beginTransaction();

        // 1. Dapatkan atau buat id_plan
        let [planRows] = await connection.query(
            `SELECT id_plan FROM sipuro_db.production_plans WHERE id_product = ?`,
            [id_product]
        );

        let id_plan;
        if (planRows.length === 0) {
            const [newPlan] = await connection.query(
                `INSERT INTO sipuro_db.production_plans (id_product, created_by, updated_by) VALUES (?, ?, ?)`,
                [id_product, created_by || null, created_by || null]
            );
            id_plan = newPlan.insertId;
        } else {
            id_plan = planRows[0].id_plan;
            await connection.query(
                `UPDATE sipuro_db.production_plans SET updated_at = NOW(), updated_by = ? WHERE id_plan = ?`,
                [created_by || null, id_plan]
            );
        }

        // Hapus revisi & item terdahulu untuk mengganti dengan dataset revisi terbaru
        const [oldRevs] = await connection.query(
            `SELECT id_revision FROM sipuro_db.production_plan_revisions WHERE id_plan = ?`,
            [id_plan]
        );

        if (oldRevs.length > 0) {
            const oldIds = oldRevs.map(r => r.id_revision);
            await connection.query(`DELETE FROM sipuro_db.production_plan_items WHERE id_revision IN (?)`, [oldIds]);
            await connection.query(`DELETE FROM sipuro_db.production_plan_revisions WHERE id_plan = ?`, [id_plan]);
        }

        // 2. Insert Ulang Seluruh Struktur Revisi
        for (const rev of revisions) {
            const [insertedRev] = await connection.query(
                `INSERT INTO sipuro_db.production_plan_revisions 
                 (id_plan, revision_type, revision_label, revision_date, created_by) 
                 VALUES (?, ?, ?, ?, ?)`,
                [
                    id_plan,
                    rev.revision_type,
                    rev.revision_label,
                    rev.revision_date || new Date().toISOString().split('T')[0],
                    created_by || null
                ]
            );

            const id_revision = insertedRev.insertId;

            // Insert item per week
            if (rev.weeks_data) {
                for (const w of weeks) {
                    const key = `${w.year}_${w.week_number}`;
                    const rawQty = rev.weeks_data[key];
                    const qtyVal = Math.max(0, parseInt(rawQty, 10) || 0);

                    await connection.query(
                        `INSERT INTO sipuro_db.production_plan_items 
                         (id_revision, year, week_number, week_start_date, qty) 
                         VALUES (?, ?, ?, ?, ?)`,
                        [
                            id_revision,
                            w.year,
                            w.week_number,
                            w.start_date || w.week_start_date || null,
                            qtyVal
                        ]
                    );
                }
            }
        }

        await connection.commit();
        res.json({ success: true, message: 'Production Plan successfully saved.' });

    } catch (error) {
        await connection.rollback();
        console.error('Error saveProductionPlan:', error);
        res.status(500).json({ success: false, message: 'Failed to save Production Plan.', error: error.message });
    } finally {
        connection.release();
    }
};
