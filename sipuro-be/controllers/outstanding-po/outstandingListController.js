'use strict';

const { sipuroDb } = require('../../config/db');
const { sendControllerError } = require('../../helpers/businessError');
const { buildListQuery, REMAINING_SQL } = require('../../helpers/outstanding-po/outstandingQueryHelper');

const FROM_SQL = `
    FROM sipuro_db.po_details d
    JOIN sipuro_db.po_headers h ON d.po_header_id = h.po_header_id
    JOIN sipuro_db.products p ON d.id_product = p.id_product`;

/**
 * Daftar Outstanding PO per produk beserta rincian PO-nya.
 * Tanpa GROUP_CONCAT: satu query untuk halaman produk, satu query untuk rincian item
 * pada halaman itu, lalu dirakit di sini (tidak ada batas panjang teks yang bisa memotong data).
 */
exports.getOutstandingList = async (req, res) => {
    try {
        const { whereSql, params, page, limit, offset, orderBySql } = buildListQuery(req.query, req.user);

        const [countRows] = await sipuroDb.query(
            `SELECT COUNT(*) AS total FROM (
                SELECT p.id_product ${FROM_SQL} WHERE ${whereSql} GROUP BY p.id_product
            ) sub`,
            params
        );
        const totalItems = Number(countRows[0]?.total || 0);
        const pagination = { totalItems, totalPages: Math.ceil(totalItems / limit), currentPage: page, limit };

        if (totalItems === 0) {
            return res.json({ success: true, data: [], pagination });
        }

        const [products] = await sipuroDb.query(
            `SELECT
                p.id_product,
                p.product_code,
                p.product_name,
                SUM(d.base_qty) AS total_required_qty,
                SUM(IFNULL(d.fulfilled_qty, 0)) AS total_produced_qty,
                SUM(${REMAINING_SQL}) AS total_remaining_qty,
                COUNT(DISTINCT h.po_header_id) AS total_po_count
             ${FROM_SQL}
             WHERE ${whereSql}
             GROUP BY p.id_product, p.product_code, p.product_name
             ${orderBySql}
             LIMIT ${limit} OFFSET ${offset}`,
            params
        );

        const productIds = products.map((row) => row.id_product);
        let items = [];
        if (productIds.length > 0) {
            [items] = await sipuroDb.query(
                `SELECT
                    d.po_detail_id,
                    d.po_header_id,
                    d.id_product,
                    h.po_number,
                    DATE_FORMAT(h.created_at, '%Y-%m-%d') AS created_date,
                    d.base_qty AS required_qty,
                    IFNULL(d.fulfilled_qty, 0) AS produced_qty,
                    ${REMAINING_SQL} AS remaining_qty,
                    d.status,
                    d.close_reason
                 ${FROM_SQL}
                 WHERE ${whereSql} AND d.id_product IN (?)
                 ORDER BY h.po_header_id ASC, d.po_detail_id ASC`,
                [...params, productIds]
            );
        }

        const itemsByProduct = new Map();
        items.forEach((row) => {
            if (!itemsByProduct.has(row.id_product)) itemsByProduct.set(row.id_product, []);
            itemsByProduct.get(row.id_product).push({
                po_header_id: row.po_header_id,
                po_detail_id: row.po_detail_id,
                po_number: row.po_number,
                created_date: row.created_date,
                required_qty: Number(row.required_qty) || 0,
                produced_qty: Number(row.produced_qty) || 0,
                remaining_qty: Number(row.remaining_qty) || 0,
                status: row.status,
                // Alasan hanya relevan selama pengajuan masih menunggu keputusan.
                close_reason: row.status === 'Close Requested' ? (row.close_reason || null) : null
            });
        });

        const data = products.map((row) => ({
            id_product: row.id_product,
            product_code: row.product_code,
            product_name: row.product_name,
            total_required_qty: Number(row.total_required_qty) || 0,
            total_produced_qty: Number(row.total_produced_qty) || 0,
            total_remaining_qty: Number(row.total_remaining_qty) || 0,
            total_po_count: Number(row.total_po_count) || 0,
            po_items: itemsByProduct.get(row.id_product) || []
        }));

        return res.json({ success: true, data, pagination });
    } catch (error) {
        return sendControllerError(res, error, {
            label: 'Error fetching outstanding PO list',
            fallbackMessage: 'Failed to fetch outstanding PO data.'
        });
    }
};
