'use strict';

/**
 * Pengelolaan daftar jenis transaksi (Trans Type) upload, dipakai halaman Setting.
 * Tidak ada penghapusan: jenis diaktifkan/dinonaktifkan (is_active). Menonaktifkan hanya menolak upload baru;
 * data lama tetap dihitung sama (arah dibaca dari tabel ini, lihat lotProductionTotals).
 *
 *  - Jenis scope LOT boleh ditambah. Nama, arah, dan cara cocok hanya boleh diubah selama jenis itu belum pernah
 *    dipakai pada upload (tanda qty data lama tidak boleh berubah mundur).
 *  - Jenis scope DO (Sales Order Issue, RMA Receipt) hanya bisa diaktifkan/dinonaktifkan: logika DO dan retur ada di kode.
 * Perubahan berjalan di dalam transaksi ber-lock bersama upload (helpers/lockedTransaction).
 */

const { BusinessError } = require('../../helpers/businessError');
const { parseIdParam } = require('../../helpers/queryParams');
const { SCOPE, MATCH_BY, normalizeTransType, validateTransTypeInput } = require('./uploadTransTypeRules');

const COLLATION = 'utf8mb4_unicode_ci';

// Tabel detail upload yang menyimpan trans_type menurut scope (menentukan apakah sebuah jenis sudah pernah dipakai)
const DETAIL_TABLE = Object.freeze({
    [SCOPE.LOT]: 'production_lot_upload_details',
    [SCOPE.DO]: 'delivery_order_upload_details'
});

// ---------- Pembacaan input (murni) ----------

const parseTypeId = (raw) => parseIdParam(raw, 'Trans type ID');

const cleanLabel = (raw) => String(raw === undefined || raw === null ? '' : raw).trim().replace(/\s+/g, ' ');

const parseIsActive = (raw) => {
    if (typeof raw !== 'boolean') {
        throw new BusinessError('isActive must be true or false.', 400);
    }
    return raw;
};

const throwIfInvalid = (input) => {
    const errors = validateTransTypeInput(input);
    if (errors.length > 0) throw new BusinessError(errors[0], 400, { problems: errors });
};

/**
 * Isian jenis baru (selalu scope LOT dan non-produksi, cara cocok Lot + Item).
 * Jenis produksi (Batch + Lot + Item) hanya WIP Completion dan WIP Completion Return dari migrasi; tidak bisa ditambah.
 */
const parseCreateBody = (body = {}) => {
    const input = {
        scope: SCOPE.LOT,
        transType: cleanLabel(body.transType),
        direction: body.direction,
        matchBy: MATCH_BY.LOT
    };
    throwIfInvalid(input);
    return input;
};

/**
 * Isian perubahan: isActive (boolean) dan/atau transType, direction, matchBy.
 * Bagian yang tidak dikirim tidak diubah. Setidaknya satu harus ada.
 */
const parseUpdateBody = (body = {}) => {
    const patch = {};
    if (body.isActive !== undefined) patch.isActive = parseIsActive(body.isActive);
    if (body.transType !== undefined) patch.transType = cleanLabel(body.transType);
    if (body.direction !== undefined) patch.direction = body.direction;
    if (body.matchBy !== undefined) patch.matchBy = body.matchBy;
    if (Object.keys(patch).length === 0) {
        throw new BusinessError('Nothing to update.', 400);
    }
    return patch;
};

// ---------- Pembacaan data ----------

const shapeRow = (row, inUse) => ({
    id: row.id,
    scope: row.scope,
    trans_type: row.trans_type,
    direction: row.direction,
    match_by: row.match_by,
    is_active: Boolean(Number(row.is_active)),
    in_use: Boolean(inUse)
});

const usedNamesOf = async (queryable, scope) => {
    const [rows] = await queryable.query(`SELECT DISTINCT trans_type FROM ${DETAIL_TABLE[scope]} WHERE trans_type IS NOT NULL`);
    return new Set(rows.map((r) => normalizeTransType(r.trans_type)));
};

/** Semua jenis (kedua scope), dengan penanda apakah sudah pernah dipakai pada upload. */
const listTransTypes = async (queryable) => {
    const [rows] = await queryable.query(
        'SELECT id, scope, trans_type, direction, match_by, is_active FROM upload_trans_types ORDER BY scope, id'
    );
    const used = {};
    for (const scope of Object.values(SCOPE)) {
        used[scope] = await usedNamesOf(queryable, scope);
    }
    return rows.map((row) => shapeRow(row, used[row.scope].has(normalizeTransType(row.trans_type))));
};

const isInUse = async (connection, row) => {
    const [found] = await connection.query(
        `SELECT 1 FROM ${DETAIL_TABLE[row.scope]} WHERE trans_type COLLATE ${COLLATION} = ? LIMIT 1`,
        [row.trans_type]
    );
    return found.length > 0;
};

const assertNameFree = async (connection, scope, typeKey, exceptId = null) => {
    const [rows] = await connection.query(
        'SELECT id FROM upload_trans_types WHERE scope = ? AND type_key = ? AND id <> ? LIMIT 1',
        [scope, typeKey, exceptId === null ? 0 : exceptId]
    );
    if (rows.length > 0) {
        throw new BusinessError('A trans type with this name already exists (letter case is ignored).', 409);
    }
};

const translateDuplicate = (error) => (error && error.code === 'ER_DUP_ENTRY'
    ? new BusinessError('A trans type with this name already exists (letter case is ignored).', 409)
    : error);

// ---------- Aksi (di dalam transaksi ber-lock) ----------

const createTransType = async (connection, { transType, direction, matchBy, scope = SCOPE.LOT, userId }) => {
    const typeKey = normalizeTransType(transType);
    await assertNameFree(connection, scope, typeKey);
    try {
        const [result] = await connection.query(
            `INSERT INTO upload_trans_types (scope, trans_type, type_key, direction, match_by, is_active, created_by, updated_by)
             VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
            [scope, transType, typeKey, direction, matchBy, userId, userId]
        );
        return shapeRow({ id: result.insertId, scope, trans_type: transType, direction, match_by: matchBy, is_active: 1 }, false);
    } catch (error) {
        throw translateDuplicate(error);
    }
};

const updateTransType = async (connection, { id, patch, userId }) => {
    const [[row]] = await connection.query(
        'SELECT id, scope, trans_type, direction, match_by, is_active FROM upload_trans_types WHERE id = ? FOR UPDATE',
        [id]
    );
    if (!row) throw new BusinessError('Trans type not found.', 404);

    // Jenis produksi dan non-produksi tidak bisa saling berubah
    if (patch.matchBy !== undefined && patch.matchBy !== row.match_by) {
        throw new BusinessError('The match type of a trans type cannot be changed. Production types (Batch + Lot + Item) are fixed.', 409);
    }

    const next = {
        transType: patch.transType !== undefined ? patch.transType : row.trans_type,
        direction: patch.direction !== undefined ? patch.direction : row.direction,
        matchBy: patch.matchBy !== undefined ? patch.matchBy : row.match_by
    };
    const definitionChanged = next.transType !== row.trans_type
        || next.direction !== row.direction
        || next.matchBy !== row.match_by;

    if (definitionChanged) {
        if (row.scope !== SCOPE.LOT) {
            throw new BusinessError('Delivery Order trans types can only be activated or deactivated.', 409);
        }
        if (await isInUse(connection, row)) {
            throw new BusinessError(
                'This trans type has already been used by an upload, so its name, direction, and match type can no longer be changed. Deactivate it and add a new one instead.',
                409
            );
        }
        throwIfInvalid({ scope: row.scope, ...next });
        await assertNameFree(connection, row.scope, normalizeTransType(next.transType), row.id);
    }

    const isActive = patch.isActive !== undefined ? (patch.isActive ? 1 : 0) : Number(row.is_active);
    if (!definitionChanged && isActive === Number(row.is_active)) {
        throw new BusinessError('No changes to save.', 400);
    }

    try {
        await connection.query(
            `UPDATE upload_trans_types
             SET trans_type = ?, type_key = ?, direction = ?, match_by = ?, is_active = ?, updated_by = ?
             WHERE id = ?`,
            [next.transType, normalizeTransType(next.transType), next.direction, next.matchBy, isActive, userId, row.id]
        );
    } catch (error) {
        throw translateDuplicate(error);
    }

    return shapeRow(
        { id: row.id, scope: row.scope, trans_type: next.transType, direction: next.direction, match_by: next.matchBy, is_active: isActive },
        await isInUse(connection, { scope: row.scope, trans_type: next.transType })
    );
};

module.exports = {
    parseTypeId,
    parseCreateBody,
    parseUpdateBody,
    listTransTypes,
    createTransType,
    updateTransType
};
