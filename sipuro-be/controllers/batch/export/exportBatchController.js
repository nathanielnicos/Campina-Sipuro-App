const XLSX = require('xlsx');
const { sipuroDb } = require('../../../config/db');
const { getWibDate } = require('../../../helpers/dateHelper');

/**
 * Helper Environment-Agnostic & Zero-Timezone Shift.
 * Mengonversi tanggal ke Nilai Serial Excel (Excel Serial Number).
 * Dijamin 100% presisi di server mana pun (Local/Vercel) dan sel di Excel tetap Native Date.
 */
const toExcelDate = (dateVal) => {
    if (!dateVal) return '-';

    let dateStr = '';

    if (dateVal instanceof Date) {
        // Ambil komponen tanggal/jam lokal murni dari objek Date
        const y = dateVal.getFullYear();
        const m = String(dateVal.getMonth() + 1).padStart(2, '0');
        const d = String(dateVal.getDate()).padStart(2, '0');
        const hh = String(dateVal.getHours()).padStart(2, '0');
        const mm = String(dateVal.getMinutes()).padStart(2, '0');
        const ss = String(dateVal.getSeconds()).padStart(2, '0');
        dateStr = `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
    } else {
        dateStr = String(dateVal).trim();
    }

    // Ambil pola "YYYY-MM-DD HH:mm:ss"
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}):(\d{2}))?/);
    if (!match) return '-';

    const [_, year, month, day, hour = '00', minute = '00', second = '00'] = match;

    // Hitung Hari Epok Excel (Epoch: 30 Dec 1899 karena bug kabisat 1900 Excel)
    const utcDate = Date.UTC(+year, +month - 1, +day, +hour, +minute, +second);
    const excelEpoch = Date.UTC(1899, 11, 30);
    const serialDate = (utcDate - excelEpoch) / (24 * 60 * 60 * 1000);

    // Kembalikan sebagai Cell Object SheetJS bertipe Number dengan Format Date
    return {
        v: serialDate,
        t: 'n',
        z: 'yyyy-mm-dd hh:mm:ss'
    };
};

exports.exportBatchMappingExcel = async (req, res) => {
    try {
        const {
            search,
            fromDate,
            toDate,
            fromPlanDate,
            toPlanDate,
            fromActualDate,
            toActualDate,
            fromCreatedDate,
            toCreatedDate,
            batchStatus
        } = req.query;

        // Mendukung alias untuk Planned Production Date
        const startDatePlan = fromPlanDate || fromDate;
        const endDatePlan = toPlanDate || toDate;

        // Tentukan apakah perlu mengikutsertakan unassigned PO
        const hasBatchSpecificFilter = Boolean(
            startDatePlan || endDatePlan || fromActualDate || toActualDate || batchStatus
        );
        const shouldIncludeUnassigned = !hasBatchSpecificFilter;

        // Where clauses & parameters terpisah untuk 2 query UNION
        let whereClauses1 = ['d.deleted_at IS NULL'];
        let queryParams1 = [];

        let whereClauses2 = ['d.deleted_at IS NULL'];
        let queryParams2 = [];

        // 1. Filter Text (Batch / SKU / Nama Produk / PO)
        if (search && search.trim() !== '') {
            const searchTerm = `%${search.trim()}%`;
            whereClauses1.push(`(b.batch_number LIKE ? OR p.product_code LIKE ? OR p.product_name LIKE ? OR h.po_number LIKE ?)`);
            queryParams1.push(searchTerm, searchTerm, searchTerm, searchTerm);

            if (shouldIncludeUnassigned) {
                whereClauses2.push(`(p.product_code LIKE ? OR p.product_name LIKE ? OR h.po_number LIKE ?)`);
                queryParams2.push(searchTerm, searchTerm, searchTerm);
            }
        }

        // 2. Filter Rentang Tanggal Rencana Produksi (Plan Production Date)
        if (startDatePlan && startDatePlan.trim() !== '') {
            whereClauses1.push(`DATE(b.plan_production_date) >= ?`);
            queryParams1.push(startDatePlan.trim());
        }
        if (endDatePlan && endDatePlan.trim() !== '') {
            whereClauses1.push(`DATE(b.plan_production_date) <= ?`);
            queryParams1.push(endDatePlan.trim());
        }

        // 3. Filter Rentang Tanggal Realisasi Produksi (Actual Production Date)
        if (fromActualDate && fromActualDate.trim() !== '') {
            whereClauses1.push(`DATE(b.actual_production_date) >= ?`);
            queryParams1.push(fromActualDate.trim());
        }
        if (toActualDate && toActualDate.trim() !== '') {
            whereClauses1.push(`DATE(b.actual_production_date) <= ?`);
            queryParams1.push(toActualDate.trim());
        }

        // 4. Filter Rentang Tanggal PO Dibuat (PO Created Date)
        if (fromCreatedDate && fromCreatedDate.trim() !== '') {
            whereClauses1.push(`DATE(h.created_at) >= ?`);
            queryParams1.push(fromCreatedDate.trim());

            if (shouldIncludeUnassigned) {
                whereClauses2.push(`DATE(h.created_at) >= ?`);
                queryParams2.push(fromCreatedDate.trim());
            }
        }
        if (toCreatedDate && toCreatedDate.trim() !== '') {
            whereClauses1.push(`DATE(h.created_at) <= ?`);
            queryParams1.push(toCreatedDate.trim());

            if (shouldIncludeUnassigned) {
                whereClauses2.push(`DATE(h.created_at) <= ?`);
                queryParams2.push(toCreatedDate.trim());
            }
        }

        // 5. Filter Status Batch
        if (batchStatus && batchStatus.trim() !== '') {
            whereClauses1.push(`b.status = ?`);
            queryParams1.push(batchStatus.trim());
        }

        const whereSql1 = whereClauses1.length > 0 ? `WHERE ${whereClauses1.join(' AND ')}` : '';
        const whereSql2 = whereClauses2.length > 0 ? `WHERE ${whereClauses2.join(' AND ')}` : '';

        // Gabungkan parameter sesuai urutan query UNION
        const queryParams = shouldIncludeUnassigned
            ? [...queryParams1, ...queryParams2]
            : queryParams1;

        const query = `
            SELECT * FROM (
                -- BAGIAN 1: Alokasi PO yang SUDAH dialokasikan ke Batch
                SELECT 
                    p.product_code AS id_produk,
                    p.product_name AS nama_produk,
                    h.po_number AS kode_po,
                    h.created_at AS tgl_po_dibuat,
                    d.base_qty AS kuantitas_po,
                    COALESCE(b.batch_number, '-') AS kode_batch,
                    b.actual_production_date AS tgl_mulai_produksi,
                    b.actual_completed_date AS tgl_selesai_produksi,
                    pba.allocated_qty AS hasil_produksi,
                    GREATEST(0, d.base_qty - COALESCE(alloc_total.total_allocated, 0)) AS sisa_po,
                    IF(pba.status IS NOT NULL, UPPER(pba.status), '-') AS status_alokasi,
                    h.created_at,
                    pba.id AS sort_id
                FROM sipuro_db.po_headers h
                JOIN sipuro_db.po_details d ON h.po_header_id = d.po_header_id
                JOIN sipuro_db.products p ON d.id_product = p.id_product
                JOIN sipuro_db.po_batch_allocations pba ON d.po_detail_id = pba.po_detail_id
                LEFT JOIN sipuro_db.batches b ON pba.id_batch = b.id
                LEFT JOIN (
                    SELECT po_detail_id, SUM(allocated_qty) AS total_allocated
                    FROM sipuro_db.po_batch_allocations
                    GROUP BY po_detail_id
                ) alloc_total ON d.po_detail_id = alloc_total.po_detail_id
                ${whereSql1}

                ${shouldIncludeUnassigned ? `
                UNION ALL

                -- BAGIAN 2: PO yang SAMA SEKALI BELUM dialokasikan ke batch mana pun
                SELECT 
                    p.product_code AS id_produk,
                    p.product_name AS nama_produk,
                    h.po_number AS kode_po,
                    h.created_at AS tgl_po_dibuat,
                    d.base_qty AS kuantitas_po,
                    '-' AS kode_batch,
                    NULL AS tgl_mulai_produksi,
                    NULL AS tgl_selesai_produksi,
                    0 AS hasil_produksi,
                    d.base_qty AS sisa_po,
                    '-' AS status_alokasi,
                    h.created_at,
                    999999999 AS sort_id
                FROM sipuro_db.po_headers h
                JOIN sipuro_db.po_details d ON h.po_header_id = d.po_header_id
                JOIN sipuro_db.products p ON d.id_product = p.id_product
                LEFT JOIN (
                    SELECT DISTINCT po_detail_id
                    FROM sipuro_db.po_batch_allocations
                ) alloc ON d.po_detail_id = alloc.po_detail_id
                ${whereSql2}
                AND alloc.po_detail_id IS NULL
                ` : ''}
            ) AS main_export
            ORDER BY created_at DESC, kode_po ASC, id_produk ASC, sort_id ASC;
        `;

        const [rows] = await sipuroDb.query(query, queryParams);

        const excelData = [];

        // BARIS PERTAMA: Header Kolom
        excelData.push([
            'Product Code',
            'Product Name',
            'PO Number',
            'PO Created Date',
            'PO Quantity (Pcs)',
            'Batch Code',
            'Production Start Date and Time',
            'Production End Date and Time',
            'Allocated Qty (Pcs)',
            'Remaining PO (Pcs)',
            'Allocation Status'
        ]);

        // Baris Data
        rows.forEach(row => {
            excelData.push([
                row.id_produk || '-',
                row.nama_produk || '-',
                row.kode_po || '-',
                toExcelDate(row.tgl_po_dibuat),
                Number(row.kuantitas_po) || 0,
                row.kode_batch,
                toExcelDate(row.tgl_mulai_produksi),
                toExcelDate(row.tgl_selesai_produksi),
                Number(row.hasil_produksi) || 0,
                Number(row.sisa_po) || 0,
                row.status_alokasi || '-'
            ]);
        });

        // Buat worksheet dari array (tanpa cellDates agar Serial Date tidak diinterupsi)
        const worksheet = XLSX.utils.aoa_to_sheet(excelData);

        worksheet['!cols'] = [
            { wch: 18 },
            { wch: 45 },
            { wch: 22 },
            { wch: 22 },
            { wch: 20 },
            { wch: 20 },
            { wch: 30 },
            { wch: 30 },
            { wch: 22 },
            { wch: 18 },
            { wch: 18 }
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Export Batch');

        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        // Standarisasi Penamaan File Menggunakan Date WIB: Export_Batch_YYYYMMDD_HHmmss.xlsx
        const nowWib = getWibDate();
        const year = nowWib.getFullYear();
        const month = String(nowWib.getMonth() + 1).padStart(2, '0');
        const day = String(nowWib.getDate()).padStart(2, '0');
        const hours = String(nowWib.getHours()).padStart(2, '0');
        const minutes = String(nowWib.getMinutes()).padStart(2, '0');
        const seconds = String(nowWib.getSeconds()).padStart(2, '0');

        const filename = `Export_Batch_${year}${month}${day}_${hours}${minutes}${seconds}.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
        res.setHeader('Content-Length', buffer.length);

        return res.status(200).end(buffer);

    } catch (error) {
        console.error('Export Excel Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to export Excel data.',
            error: error.message
        });
    }
};
