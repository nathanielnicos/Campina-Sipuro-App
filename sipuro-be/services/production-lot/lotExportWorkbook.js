'use strict';

/**
 * Menyusun workbook ekspor mapping Production Lot.
 * Sheet "Allocations": satu baris per alokasi, tanpa nilai tingkat PO (qty PO, sisa, persen) agar pivot tidak menghitung ganda.
 * Kolom akhir: kode produk lot dan penanda alokasi lewat pemetaan kode produk (kode lot berbeda dari kode PO).
 * Sheet "PO Items": satu baris per item PO dengan qty PO, total teralokasi, sisa, dan persen.
 */

const XLSX = require('xlsx');
const { toExcelDate } = require('../../helpers/excelDate');

const ALLOCATION_HEADERS = [
    'Product Code',
    'Product Name',
    'PO Number',
    'PO Created Date',
    'Batch Number',
    'Lot Number',
    'Lot Completed Date',
    'Lot Expired Date',
    'Allocated Qty (Pcs)',
    'Allocation Status',
    'Lot Product Code',
    'Via Mapping'
];

const PO_ITEM_HEADERS = [
    'PO Number',
    'PO Created Date',
    'Product Code',
    'Product Name',
    'PO Qty (Pcs)',
    'Total Allocated (Pcs)',
    'Remaining (Pcs)',
    'Fulfillment %'
];

const PERCENT_FORMAT = '0.0%';

const blankIfEmpty = (value) => (value === null || value === undefined || value === '' ? null : value);

const buildAllocationRows = (allocations) => [
    ALLOCATION_HEADERS,
    ...allocations.map((r) => [
        blankIfEmpty(r.product_code),
        blankIfEmpty(r.product_name),
        blankIfEmpty(r.po_number),
        toExcelDate(r.po_created_at),
        blankIfEmpty(r.batch_number),
        blankIfEmpty(r.lot_number),
        toExcelDate(r.lot_completed_at),
        toExcelDate(r.lot_expired_date, { dateOnly: true }),
        Number(r.allocated_qty) || 0,
        blankIfEmpty(r.allocation_status),
        blankIfEmpty(r.lot_product_code),
        Number(r.via_mapping) ? 'Yes' : 'No'
    ])
];

const buildPoItemRows = (poItems) => [
    PO_ITEM_HEADERS,
    ...poItems.map((r) => {
        const baseQty = Number(r.base_qty) || 0;
        const totalAllocated = Number(r.total_allocated) || 0;
        return [
            blankIfEmpty(r.po_number),
            toExcelDate(r.po_created_at),
            blankIfEmpty(r.product_code),
            blankIfEmpty(r.product_name),
            baseQty,
            totalAllocated,
            Math.max(0, baseQty - totalAllocated),
            { v: baseQty > 0 ? totalAllocated / baseQty : 0, t: 'n', z: PERCENT_FORMAT }
        ];
    })
];

const addSheet = (workbook, name, rows, widths) => {
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet['!cols'] = widths.map((wch) => ({ wch }));
    sheet['!autofilter'] = { ref: `A1:${String.fromCharCode(64 + widths.length)}${Math.max(1, rows.length)}` };
    XLSX.utils.book_append_sheet(workbook, sheet, name);
};

const buildExportWorkbookBuffer = ({ allocations, poItems }) => {
    const workbook = XLSX.utils.book_new();
    addSheet(workbook, 'Allocations', buildAllocationRows(allocations), [18, 45, 22, 22, 20, 20, 22, 18, 20, 18, 18, 14]);
    addSheet(workbook, 'PO Items', buildPoItemRows(poItems), [22, 22, 18, 45, 18, 22, 18, 16]);
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

const pad = (n) => String(n).padStart(2, '0');

// Nama file dari waktu WIB yang diberikan pemanggil (objek dengan komponen lokal WIB)
const buildExportFileName = (nowWib) =>
    `Export_Lot_Mapping_${nowWib.getFullYear()}${pad(nowWib.getMonth() + 1)}${pad(nowWib.getDate())}_${pad(nowWib.getHours())}${pad(nowWib.getMinutes())}${pad(nowWib.getSeconds())}.xlsx`;

module.exports = {
    ALLOCATION_HEADERS,
    PO_ITEM_HEADERS,
    buildAllocationRows,
    buildPoItemRows,
    buildExportWorkbookBuffer,
    buildExportFileName
};
