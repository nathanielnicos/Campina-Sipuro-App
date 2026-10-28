'use strict';

/**
 * Pengelolaan pemetaan kode produk (kode lama <-> kode baru, produk yang sebenarnya sama).
 * Hanya SUPERADMIN. Tidak ada penghapusan: pemetaan diaktifkan/dinonaktifkan (is_active). Hanya pemetaan
 * aktif yang membentuk keluarga produk. Perubahan berjalan di dalam transaksi ber-lock bersama upload lot
 * (lotLockedTransaction), sehingga hasil preview/commit upload tidak berubah di tengah proses.
 */

const { BusinessError } = require('../../helpers/businessError');
const { asText, parseIdParam, escapeLike } = require('../../helpers/queryParams');
const { buildFamilyIndex } = require('./productFamilies');

const ALL_MAPPINGS_SQL = 'SELECT id_product_old, id_product_new, is_active FROM product_code_mappings';

const isActiveFlag = (row) => Number(row.is_active) === 1;

// ---------- Pembacaan input (murni) ----------

const parseProductId = (raw, label) => parseIdParam(raw, label);

const parseMappingId = (raw) => parseIdParam(raw, 'Mapping ID');

// Status harus boolean sungguhan (true/false); teks atau angka ditolak agar tidak salah tafsir.
const parseIsActive = (raw) => {
    if (typeof raw !== 'boolean') {
        throw new BusinessError('isActive must be true or false.', 400);
    }
    return raw;
};

// ---------- Daftar ----------

const shapeProduct = (row, prefix) => ({
    id_product: row[`${prefix}_id`],
    product_code: row[`${prefix}_code`],
    product_name: row[`${prefix}_name`],
    is_active: Boolean(row[`${prefix}_active`])
});

const listMappings = async (db, { search, page, limit, offset }) => {
    const conditions = [];
    const params = [];
    const term = asText(search);
    if (term) {
        const like = `%${escapeLike(term)}%`;
        conditions.push('(po.product_code LIKE ? OR po.product_name LIKE ? OR pn.product_code LIKE ? OR pn.product_name LIKE ?)');
        params.push(like, like, like, like);
    }
    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const fromSql = `FROM product_code_mappings m
        JOIN products po ON po.id_product = m.id_product_old
        JOIN products pn ON pn.id_product = m.id_product_new
        LEFT JOIN employees e ON e.id = m.created_by`;

    const [[countRow]] = await db.query(`SELECT COUNT(*) AS total ${fromSql} ${whereSql}`, params);
    const totalItems = Number(countRow && countRow.total) || 0;

    const [rows] = await db.query(
        `SELECT m.id, m.is_active, DATE_FORMAT(m.created_at, '%Y-%m-%d %H:%i:%s') AS created_at, e.full_name AS created_by_name,
                po.id_product AS old_id, po.product_code AS old_code, po.product_name AS old_name, po.is_active AS old_active,
                pn.id_product AS new_id, pn.product_code AS new_code, pn.product_name AS new_name, pn.is_active AS new_active
         ${fromSql} ${whereSql}
         ORDER BY m.id DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
    );

    return {
        data: rows.map((r) => ({
            id: r.id,
            is_active: Boolean(Number(r.is_active)),
            old_product: shapeProduct(r, 'old'),
            new_product: shapeProduct(r, 'new'),
            created_by_name: r.created_by_name || null,
            created_at: r.created_at
        })),
        pagination: { totalItems, totalPages: Math.ceil(totalItems / limit), currentPage: page, limit }
    };
};

// ---------- Tambah / hapus ----------

const logMapping = (connection, { mappingId, idProductOld, idProductNew, action, userId }) =>
    connection.query(
        `INSERT INTO product_code_mapping_logs (mapping_id, id_product_old, id_product_new, action_type, created_by)
         VALUES (?, ?, ?, ?, ?)`,
        [mappingId, idProductOld, idProductNew, action, userId]
    );

/**
 * Menambah pemetaan (langsung aktif). Ditolak jika pasangan itu sudah ada (aktif atau nonaktif, arah mana pun)
 * atau kedua produk sudah terhubung lewat pemetaan aktif lain, sehingga tidak ada pasangan ganda atau siklus.
 */
const createMapping = async (connection, { idProductOld, idProductNew, userId }) => {
    if (idProductOld === idProductNew) {
        throw new BusinessError('A product cannot be mapped to itself.', 400);
    }

    const [products] = await connection.query(
        'SELECT id_product FROM products WHERE id_product IN (?, ?)',
        [idProductOld, idProductNew]
    );
    const found = new Set(products.map((p) => p.id_product));
    if (!found.has(idProductOld)) throw new BusinessError('Old product not found.', 404);
    if (!found.has(idProductNew)) throw new BusinessError('New product not found.', 404);

    // Pasangan yang sama (arah mana pun) tidak boleh dobel, aktif maupun nonaktif
    const [mappings] = await connection.query(ALL_MAPPINGS_SQL);
    const existing = mappings.find((m) =>
        (m.id_product_old === idProductOld && m.id_product_new === idProductNew)
        || (m.id_product_old === idProductNew && m.id_product_new === idProductOld));
    if (existing) {
        throw new BusinessError(
            isActiveFlag(existing)
                ? 'These products are already mapped.'
                : 'These products are already mapped but the mapping is inactive. Activate it instead.',
            409
        );
    }
    // Sudah terhubung lewat pemetaan aktif lain (rantai): tidak perlu pemetaan baru
    if (buildFamilyIndex(mappings.filter(isActiveFlag)).sameFamily(idProductOld, idProductNew)) {
        throw new BusinessError('These products are already linked through other active mappings.', 409);
    }

    let insertId;
    try {
        const [result] = await connection.query(
            'INSERT INTO product_code_mappings (id_product_old, id_product_new, created_by) VALUES (?, ?, ?)',
            [idProductOld, idProductNew, userId]
        );
        insertId = result.insertId;
    } catch (error) {
        if (error && error.code === 'ER_DUP_ENTRY') {
            throw new BusinessError('These products are already mapped.', 409);
        }
        throw error;
    }

    await logMapping(connection, { mappingId: insertId, idProductOld, idProductNew, action: 'CREATE', userId });
    return { id: insertId, id_product_old: idProductOld, id_product_new: idProductNew, is_active: true };
};

/**
 * Mengaktifkan/menonaktifkan pemetaan. Alokasi yang sudah terjadi tidak berubah;
 * perubahan hanya memengaruhi upload berikutnya.
 */
const setMappingActive = async (connection, { mappingId, isActive, userId }) => {
    const [[mapping]] = await connection.query(
        'SELECT id, id_product_old, id_product_new, is_active FROM product_code_mappings WHERE id = ? FOR UPDATE',
        [mappingId]
    );
    if (!mapping) {
        throw new BusinessError('Product code mapping not found.', 404);
    }
    if (isActiveFlag(mapping) === isActive) {
        throw new BusinessError(`The mapping is already ${isActive ? 'active' : 'inactive'}.`, 400);
    }

    await connection.query('UPDATE product_code_mappings SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, mappingId]);
    await logMapping(connection, {
        mappingId,
        idProductOld: mapping.id_product_old,
        idProductNew: mapping.id_product_new,
        action: isActive ? 'ACTIVATE' : 'DEACTIVATE',
        userId
    });
    return { id: mappingId, is_active: isActive };
};

module.exports = { parseProductId, parseMappingId, parseIsActive, listMappings, createMapping, setMappingActive };
