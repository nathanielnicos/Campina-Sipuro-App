'use strict';

/**
 * Pengelolaan pemetaan kode produk (kode lama <-> kode baru, produk yang sebenarnya sama).
 * Hanya SUPERADMIN. Perubahan berjalan di dalam transaksi ber-lock bersama upload lot
 * (lotLockedTransaction), sehingga hasil preview/commit upload tidak berubah di tengah proses.
 */

const { BusinessError } = require('../../helpers/businessError');
const { asText, parseIdParam, escapeLike } = require('../../helpers/queryParams');
const { buildFamilyIndex } = require('./productFamilies');

const PAIRS_SQL = 'SELECT id_product_old, id_product_new FROM product_code_mappings';

// ---------- Pembacaan input (murni) ----------

const parseProductId = (raw, label) => parseIdParam(raw, label);

const parseMappingId = (raw) => parseIdParam(raw, 'Mapping ID');

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
        `SELECT m.id, DATE_FORMAT(m.created_at, '%Y-%m-%d %H:%i:%s') AS created_at, e.full_name AS created_by_name,
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
 * Menambah pemetaan. Ditolak jika kedua produk sudah sekeluarga (langsung maupun lewat rantai),
 * sehingga tidak ada pasangan ganda, pasangan terbalik, atau siklus.
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

    const [pairs] = await connection.query(PAIRS_SQL);
    if (buildFamilyIndex(pairs).sameFamily(idProductOld, idProductNew)) {
        throw new BusinessError('These products are already linked, directly or through other mappings.', 409);
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
            throw new BusinessError('These products are already linked, directly or through other mappings.', 409);
        }
        throw error;
    }

    await logMapping(connection, { mappingId: insertId, idProductOld, idProductNew, action: 'CREATE', userId });
    return { id: insertId, id_product_old: idProductOld, id_product_new: idProductNew };
};

/**
 * Menghapus pemetaan. Alokasi yang sudah terjadi tidak berubah.
 */
const deleteMapping = async (connection, { mappingId, userId }) => {
    const [[mapping]] = await connection.query(
        'SELECT id, id_product_old, id_product_new FROM product_code_mappings WHERE id = ? FOR UPDATE',
        [mappingId]
    );
    if (!mapping) {
        throw new BusinessError('Product code mapping not found.', 404);
    }

    await connection.query('DELETE FROM product_code_mappings WHERE id = ?', [mappingId]);
    await logMapping(connection, {
        mappingId,
        idProductOld: mapping.id_product_old,
        idProductNew: mapping.id_product_new,
        action: 'DELETE',
        userId
    });
    return { id: mappingId };
};

module.exports = { parseProductId, parseMappingId, listMappings, createMapping, deleteMapping };
