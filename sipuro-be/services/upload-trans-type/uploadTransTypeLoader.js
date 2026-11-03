'use strict';

/**
 * Memuat jenis transaksi AKTIF sebuah scope dari tabel upload_trans_types.
 * Jenis nonaktif tidak dikenali lagi untuk upload baru; data lama tetap dihitung (lihat lotProductionTotals).
 */

const { rowToRule, buildRuleFinder } = require('./uploadTransTypeRules');

const loadActiveRules = async (queryable, scope) => {
    const [rows] = await queryable.query(
        'SELECT trans_type, direction, match_by FROM upload_trans_types WHERE scope = ? AND is_active = 1',
        [scope]
    );
    return rows.map(rowToRule);
};

const loadRuleFinder = async (queryable, scope) => buildRuleFinder(await loadActiveRules(queryable, scope));

module.exports = { loadActiveRules, loadRuleFinder };
