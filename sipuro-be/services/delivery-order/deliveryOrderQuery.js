'use strict';

/**
 * Query daftar Delivery Order untuk tiga tampilan.
 * Selalu dua langkah: (1) ambil satu halaman kunci induk yang unik (nomor DO / nomor lot / nomor retur),
 * (2) ambil seluruh barisnya. Dengan begitu pagination menghitung induk, bukan baris join.
 * Filter pencarian dan tanggal ikut dipasang di langkah 2, sehingga baris yang tampil sesuai filter.
 */

const { DO_FROM_SQL, RETURN_FROM_SQL } = require('./deliveryOrderFilters');

const num = (value) => Number(value) || 0;

// ---------- Perakit hasil (fungsi murni) ----------

// DO -> item -> lot (frontend memilih tingkat Summary atau Detail)
const shapeByDo = (rows) => {
    const doMap = new Map();
    rows.forEach((row) => {
        if (!doMap.has(row.delivery_order_id)) {
            doMap.set(row.delivery_order_id, {
                delivery_order_id: row.delivery_order_id,
                do_number: row.do_number,
                do_datetime: row.do_datetime,
                items: new Map()
            });
        }
        const order = doMap.get(row.delivery_order_id);

        if (!order.items.has(row.id_product)) {
            order.items.set(row.id_product, {
                id_product: row.id_product,
                product_code: row.product_code,
                product_name: row.product_name,
                date_time: row.lot_datetime,
                total_qty_pcs: 0,
                total_qty_ctn: 0,
                lots: []
            });
        }
        const item = order.items.get(row.id_product);
        const qtyPcs = num(row.qty_pcs);
        const qtyCtn = num(row.qty_ctn);

        item.total_qty_pcs += qtyPcs;
        item.total_qty_ctn = Math.round((item.total_qty_ctn + qtyCtn) * 100) / 100;
        if (row.lot_datetime < item.date_time) item.date_time = row.lot_datetime;
        item.lots.push({ lot_number: row.lot_number, date_time: row.lot_datetime, qty_pcs: qtyPcs, qty_ctn: qtyCtn });
    });

    return Array.from(doMap.values()).map((order) => ({ ...order, items: Array.from(order.items.values()) }));
};

// Waktu (ms) dari Date atau teks 'YYYY-MM-DD HH:MM:SS'; kosong / tidak valid dianggap 0
const timeOf = (value) => {
    if (!value) return 0;
    if (value instanceof Date) return value.getTime();
    const ms = Date.parse(String(value).replace(' ', 'T'));
    return Number.isNaN(ms) ? 0 : ms;
};

const round2 = (value) => Math.round(value * 100) / 100;

// Carton dari pcs; produk tanpa pcs per carton -> 0 (tampil "-")
const ctnOf = (pcs, pcsPerCtn) => (num(pcsPerCtn) > 0 ? round2(pcs / num(pcsPerCtn)) : 0);

const ENTRY_RANK = { DO: 0, RETURN: 1 };

/**
 * Buku besar per lot (satu lot = satu produk): saldo awal = Qty Lot (produksi bersih dari upload),
 * lalu tiap DO mengurangi dan tiap retur menambah. Urutan: waktu, pada waktu sama DO dulu baru retur.
 * Satu baris keluaran = satu transaksi (DO atau retur) dengan saldo sesudahnya (balance_pcs).
 * Field lama (delivery_order_id, do_number, do_datetime, qty_pcs, qty_ctn) tetap ada; untuk baris retur
 * field DO bernilai null.
 *
 * @param {Array} ledgerRows transaksi DO dan retur untuk lot yang tampil (hasil query ledger)
 * @param {Array} lotRows    data lot: tanggal selesai, exp, qty_lot, allocated_qty
 * @param {Array} keys       urutan nomor lot pada halaman (menentukan urutan tampil)
 */
const shapeByLot = (ledgerRows, lotRows = [], keys = null) => {
    const lotInfo = new Map();
    const lotsByNumber = new Map();
    lotRows.forEach((row) => {
        lotInfo.set(`${row.lot_number}|${row.id_product}`, row);
        lotsByNumber.set(row.lot_number, [...(lotsByNumber.get(row.lot_number) || []), row]);
    });
    // Cadangan: DO lama bisa memakai id produk lama (kode diganti), sedangkan lot memakai id produk baru.
    // Bila nomor lot hanya punya satu data lot, pakai itu.
    const infoOf = (lot, idProduct) => {
        const exact = lotInfo.get(`${lot}|${idProduct}`);
        if (exact) return exact;
        const sameLot = lotsByNumber.get(lot) || [];
        return sameLot.length === 1 ? sameLot[0] : {};
    };

    const groups = new Map();
    ledgerRows.forEach((row) => {
        const groupKey = `${row.lot_number}|${row.id_product}`;
        if (!groups.has(groupKey)) groups.set(groupKey, { lot_number: row.lot_number, rows: [] });
        groups.get(groupKey).rows.push(row);
    });

    const keyOrder = new Map((keys || []).map((key, idx) => [String(key), idx]));
    const orderOfLot = (lot) => (keyOrder.has(String(lot)) ? keyOrder.get(String(lot)) : Number.MAX_SAFE_INTEGER);

    const orderedGroups = Array.from(groups.entries()).sort(([, a], [, b]) => {
        const byLot = orderOfLot(a.lot_number) - orderOfLot(b.lot_number);
        if (byLot !== 0) return byLot;
        return String(a.rows[0].product_code).localeCompare(String(b.rows[0].product_code));
    });

    const out = [];
    orderedGroups.forEach(([, group]) => {
        const info = infoOf(group.lot_number, group.rows[0].id_product);
        const qtyLot = num(info.qty_lot);
        const allocatedQty = num(info.allocated_qty);
        const first = group.rows[0];
        const entries = [...group.rows].sort((a, b) =>
            timeOf(a.entry_datetime) - timeOf(b.entry_datetime)
            || ENTRY_RANK[a.entry_type] - ENTRY_RANK[b.entry_type]
            || num(a.ref_id) - num(b.ref_id));

        let balance = qtyLot;
        entries.forEach((entry) => {
            const qtyPcs = num(entry.qty_pcs);
            const qtyCtn = num(entry.qty_ctn);
            const isDo = entry.entry_type === 'DO';
            balance += isDo ? -qtyPcs : qtyPcs;

            out.push({
                lot_number: entry.lot_number,
                id_product: entry.id_product,
                product_code: entry.product_code,
                product_name: entry.product_name,
                actual_completed_datetime: info.actual_completed_datetime || null,
                expired_date: info.expired_date || null,
                qty_lot: qtyLot,
                qty_lot_ctn: ctnOf(qtyLot, first.pcs_per_ctn),
                // Lot berproduksi tetapi tanpa alokasi PO (mis. rework): penanda untuk dicek manual
                is_unallocated: qtyLot > 0 && allocatedQty === 0,
                entry_type: entry.entry_type,
                entry_id: entry.ref_id,
                entry_number: entry.ref_number,
                entry_datetime: entry.entry_datetime,
                delivery_order_id: isDo ? entry.ref_id : null,
                do_number: isDo ? entry.ref_number : null,
                do_datetime: isDo ? entry.entry_datetime : null,
                qty_pcs: qtyPcs,
                qty_ctn: qtyCtn,
                signed_qty_pcs: isDo ? -qtyPcs : qtyPcs,
                signed_qty_ctn: isDo ? -qtyCtn : qtyCtn,
                balance_pcs: balance,
                balance_ctn: ctnOf(balance, first.pcs_per_ctn)
            });
        });
    });
    return out;
};

const shapeByReturn = (rows) => rows.map((row) => ({
    return_id: row.return_id,
    return_number: row.return_number,
    return_datetime: row.return_datetime,
    lot_number: row.lot_number,
    id_product: row.id_product,
    product_code: row.product_code,
    product_name: row.product_name,
    qty_pcs: num(row.qty_pcs),
    qty_ctn: num(row.qty_ctn)
}));

// ---------- Buku besar lot ----------

const COLLATE = 'COLLATE utf8mb4_unicode_ci';

// Seluruh DO dan retur untuk lot yang tampil (tanpa filter tanggal / pencarian), agar saldo berjalan selalu benar
const LOT_LEDGER_SQL = `SELECT 'DO' AS entry_type, dol.lot_number ${COLLATE} AS lot_number,
        p.id_product, p.product_code, p.product_name, p.pcs_per_ctn,
        d.id AS ref_id, d.do_number ${COLLATE} AS ref_number, MIN(dol.do_datetime) AS entry_datetime,
        SUM(dol.qty_pcs) AS qty_pcs, SUM(dol.qty_ctn) AS qty_ctn
    ${DO_FROM_SQL}
    WHERE dol.lot_number IN (?)
    GROUP BY dol.lot_number, p.id_product, p.product_code, p.product_name, p.pcs_per_ctn, d.id, d.do_number
    UNION ALL
    SELECT 'RETURN' AS entry_type, r.lot_number ${COLLATE} AS lot_number,
        p.id_product, p.product_code, p.product_name, p.pcs_per_ctn,
        MIN(r.id) AS ref_id, r.return_number ${COLLATE} AS ref_number, MIN(r.return_datetime) AS entry_datetime,
        SUM(r.qty_pcs) AS qty_pcs, SUM(r.qty_ctn) AS qty_ctn
    ${RETURN_FROM_SQL}
    WHERE r.lot_number IN (?)
    GROUP BY r.lot_number, p.id_product, p.product_code, p.product_name, p.pcs_per_ctn, r.return_number`;

// Data lot: tanggal selesai, exp, Qty Lot (produksi bersih semua status dari upload: IN dikurangi OUT, sama dengan
// Cek Saldo Lot) dan total alokasi PO (selain Canceled)
const LOT_INFO_SQL = `SELECT l.lot_number ${COLLATE} AS lot_number, l.id_product,
        MIN(l.actual_completed_datetime) AS actual_completed_datetime,
        MIN(l.expired_date) AS expired_date,
        COALESCE(MAX(pr.net_all), 0) AS qty_lot,
        COALESCE(SUM(al.allocated), 0) AS allocated_qty
    FROM lots l
    JOIN products p ON p.id_product = l.id_product
    LEFT JOIN (
        SELECT u.lot_number, u.item_code,
               SUM(CASE t.direction WHEN 'IN' THEN u.qty_pac ELSE -u.qty_pac END) AS net_all
        FROM production_lot_upload_details u
        JOIN (SELECT trans_type, MIN(direction) AS direction FROM upload_trans_types
              WHERE scope = 'LOT' AND is_active = 1 GROUP BY trans_type) t
          ON t.trans_type ${COLLATE} = u.trans_type ${COLLATE}
        WHERE u.lot_number IN (?)
        GROUP BY u.lot_number, u.item_code
    ) pr ON pr.lot_number ${COLLATE} = l.lot_number ${COLLATE} AND pr.item_code ${COLLATE} = p.product_code ${COLLATE}
    LEFT JOIN (
        SELECT lot_id, SUM(allocated_qty) AS allocated
        FROM po_lot_allocations WHERE status <> 'Canceled' GROUP BY lot_id
    ) al ON al.lot_id = l.id
    WHERE l.lot_number IN (?)
    GROUP BY l.lot_number, l.id_product`;

async function loadLotLedger(queryable, request, keys) {
    const [ledgerRows] = await queryable.query(LOT_LEDGER_SQL, [keys, keys]);
    const [lotRows] = await queryable.query(LOT_INFO_SQL, [keys, keys]);
    return shapeByLot(ledgerRows, lotRows, keys);
}

// ---------- Definisi per tampilan ----------

const MODES = {
    BY_DO: {
        fromSql: DO_FROM_SQL,
        keyExpr: 'd.id',
        pageSql: (order) => `SELECT d.id AS key_id ${DO_FROM_SQL}`
            + ` WHERE {WHERE} GROUP BY d.id, d.do_datetime ORDER BY d.do_datetime ${order}, d.id ${order} LIMIT ? OFFSET ?`,
        detailSql: (order) => `SELECT d.id AS delivery_order_id, d.do_number, d.do_datetime,
                p.id_product, p.product_code, p.product_name, dol.lot_number,
                SUM(dol.qty_pcs) AS qty_pcs, SUM(dol.qty_ctn) AS qty_ctn, MIN(dol.do_datetime) AS lot_datetime
            ${DO_FROM_SQL}
            WHERE {WHERE} AND d.id IN (?)
            GROUP BY d.id, d.do_number, d.do_datetime, p.id_product, p.product_code, p.product_name, dol.lot_number
            ORDER BY d.do_datetime ${order}, d.id ${order}, p.product_code ASC, dol.lot_number ASC`,
        shape: shapeByDo
    },
    BY_LOT: {
        fromSql: DO_FROM_SQL,
        keyExpr: 'dol.lot_number',
        // Halaman lot ditentukan oleh filter (lot yang punya DO sesuai filter); isi buku besarnya lengkap (loadDetail)
        pageSql: (order) => `SELECT dol.lot_number AS key_id ${DO_FROM_SQL}`
            + ` WHERE {WHERE} GROUP BY dol.lot_number ORDER BY dol.lot_number ${order} LIMIT ? OFFSET ?`,
        loadDetail: loadLotLedger
    },
    BY_RETURN: {
        fromSql: RETURN_FROM_SQL,
        keyExpr: 'r.return_number',
        pageSql: (order) => `SELECT r.return_number AS key_id ${RETURN_FROM_SQL}`
            + ` WHERE {WHERE} GROUP BY r.return_number ORDER BY MIN(r.return_datetime) ${order}, r.return_number ${order} LIMIT ? OFFSET ?`,
        detailSql: (order) => `SELECT r.id AS return_id, r.return_number, r.return_datetime, r.lot_number,
                p.id_product, p.product_code, p.product_name, r.qty_pcs, r.qty_ctn
            ${RETURN_FROM_SQL}
            WHERE {WHERE} AND r.return_number IN (?)
            ORDER BY r.return_datetime ${order}, r.return_number ${order}, p.product_code ASC, r.lot_number ASC, r.id ASC`,
        shape: shapeByReturn
    }
};

const withWhere = (sql, whereSql) => sql.replace('{WHERE}', whereSql);

/**
 * @param {{ displayMode, whereSql, params, limit, offset, order }} request hasil parseDeliveryOrderRequest
 * @returns {Promise<{ data: Array, totalItems: number }>}
 */
const fetchDeliveryOrderPage = async (queryable, request) => {
    const mode = MODES[request.displayMode];
    const { whereSql, params, limit, offset, order } = request;

    const [[countRow]] = await queryable.query(
        `SELECT COUNT(DISTINCT ${mode.keyExpr}) AS total ${mode.fromSql} WHERE ${whereSql}`,
        params
    );
    const totalItems = num(countRow && countRow.total);
    if (totalItems === 0) return { data: [], totalItems };

    const [pageRows] = await queryable.query(
        withWhere(mode.pageSql(order), whereSql),
        [...params, limit, offset]
    );
    const keys = pageRows.map((r) => r.key_id);
    if (keys.length === 0) return { data: [], totalItems };

    if (mode.loadDetail) {
        return { data: await mode.loadDetail(queryable, request, keys), totalItems };
    }

    const [rows] = await queryable.query(
        withWhere(mode.detailSql(order), whereSql),
        [...params, keys]
    );

    return { data: mode.shape(rows), totalItems };
};

module.exports = { fetchDeliveryOrderPage, shapeByDo, shapeByLot, shapeByReturn };
