'use strict';

/**
 * Menyusun workbook ekspor Delivery Order.
 * Sheet "Deliveries": satu baris per (DO, item, lot), tanpa nilai tingkat lot agar pivot tidak menghitung ganda.
 * Sheet "Returns"   : satu baris per baris retur.
 * Sheet "Lot Balance": satu baris per (kode produk, lot) dengan nilai tingkat lot (teralokasi, terkirim, diretur, sisa kuota).
 * Sisa kuota kirim = teralokasi - terkirim (retur tidak membuka kuota kirim lagi).
 */

const XLSX = require('xlsx');
const { toExcelDate } = require('../../helpers/excelDate');

const DELIVERY_HEADERS = [
    'DO Number',
    'DO Date',
    'Product Code',
    'Product Name',
    'Lot Number',
    'Lot Completed Date',
    'Lot Expired Date',
    'Qty (Pcs)',
    'Qty (Ctn)'
];

const RETURN_HEADERS = [
    'Return Number',
    'Return Date',
    'Product Code',
    'Product Name',
    'Lot Number',
    'Qty (Pcs)',
    'Qty (Ctn)'
];

const LOT_BALANCE_HEADERS = [
    'Product Code',
    'Product Name',
    'Lot Number',
    'Allocated (Pcs)',
    'Delivered (Pcs)',
    'Returned (Pcs)',
    'Remaining Quota (Pcs)'
];

const blankIfEmpty = (value) => (value === null || value === undefined || value === '' ? null : value);

const buildDeliveryRows = (deliveries) => [
    DELIVERY_HEADERS,
    ...deliveries.map((r) => [
        blankIfEmpty(r.do_number),
        toExcelDate(r.do_datetime),
        blankIfEmpty(r.product_code),
        blankIfEmpty(r.product_name),
        blankIfEmpty(r.lot_number),
        toExcelDate(r.lot_completed_at),
        toExcelDate(r.lot_expired_date, { dateOnly: true }),
        Number(r.qty_pcs) || 0,
        Number(r.qty_ctn) || 0
    ])
];

const buildReturnRows = (returns) => [
    RETURN_HEADERS,
    ...returns.map((r) => [
        blankIfEmpty(r.return_number),
        toExcelDate(r.return_datetime),
        blankIfEmpty(r.product_code),
        blankIfEmpty(r.product_name),
        blankIfEmpty(r.lot_number),
        Number(r.qty_pcs) || 0,
        Number(r.qty_ctn) || 0
    ])
];

const buildLotBalanceRows = (lotBalance) => [
    LOT_BALANCE_HEADERS,
    ...lotBalance.map((r) => {
        const allocated = Number(r.allocated_qty) || 0;
        const delivered = Number(r.delivered_qty) || 0;
        return [
            blankIfEmpty(r.product_code),
            blankIfEmpty(r.product_name),
            blankIfEmpty(r.lot_number),
            allocated,
            delivered,
            Number(r.returned_qty) || 0,
            Math.max(0, allocated - delivered)
        ];
    })
];

const addSheet = (workbook, name, rows, widths) => {
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet['!cols'] = widths.map((wch) => ({ wch }));
    sheet['!autofilter'] = { ref: `A1:${String.fromCharCode(64 + widths.length)}${Math.max(1, rows.length)}` };
    XLSX.utils.book_append_sheet(workbook, sheet, name);
};

const buildExportWorkbookBuffer = ({ deliveries, returns, lotBalance }) => {
    const workbook = XLSX.utils.book_new();
    addSheet(workbook, 'Deliveries', buildDeliveryRows(deliveries), [22, 22, 18, 45, 20, 22, 18, 14, 14]);
    addSheet(workbook, 'Returns', buildReturnRows(returns), [22, 22, 18, 45, 20, 14, 14]);
    addSheet(workbook, 'Lot Balance', buildLotBalanceRows(lotBalance), [18, 45, 20, 18, 18, 18, 22]);
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

const pad = (n) => String(n).padStart(2, '0');

// Nama file dari waktu WIB yang diberikan pemanggil (objek dengan komponen lokal WIB)
const buildExportFileName = (nowWib) =>
    `Export_Delivery_Order_${nowWib.getFullYear()}${pad(nowWib.getMonth() + 1)}${pad(nowWib.getDate())}_${pad(nowWib.getHours())}${pad(nowWib.getMinutes())}${pad(nowWib.getSeconds())}.xlsx`;

module.exports = {
    DELIVERY_HEADERS,
    RETURN_HEADERS,
    LOT_BALANCE_HEADERS,
    buildDeliveryRows,
    buildReturnRows,
    buildLotBalanceRows,
    buildExportWorkbookBuffer,
    buildExportFileName
};
