const XLSX = require('xlsx');
const { sipuroDb } = require('../../config/db');

exports.exportBatchMappingExcel = async (req, res) => {
    try {
        const { search, fromDate, toDate, batchStatus } = req.query;

        let whereClauses = ['d.deleted_at IS NULL'];
        let queryParams = [];

        // 1. Filter Text (Batch / SKU / Nama Produk / PO)
        if (search && search.trim() !== '') {
            whereClauses.push(`(b.batch_number LIKE ? OR p.product_code LIKE ? OR p.product_name LIKE ? OR h.po_number LIKE ?)`);
            queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }

        // 2. Filter Rentang Tanggal Rencana Produksi (fromDate & toDate)
        if (fromDate && fromDate.trim() !== '') {
            whereClauses.push(`DATE(b.plan_production_date) >= ?`);
            queryParams.push(fromDate);
        }

        if (toDate && toDate.trim() !== '') {
            whereClauses.push(`DATE(b.plan_production_date) <= ?`);
            queryParams.push(toDate);
        }

        // 3. Filter Status Batch
        if (batchStatus && batchStatus.trim() !== '') {
            whereClauses.push(`b.status = ?`);
            queryParams.push(batchStatus);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const query = `
            SELECT 
                p.product_code AS id_produk,
                p.product_name AS nama_produk,
                h.po_number AS kode_po,
                DATE_FORMAT(h.created_at, '%d/%m/%Y') AS tgl_po_dibuat,
                IF(h.requested_delivery_date IS NOT NULL, DATE_FORMAT(h.requested_delivery_date, '%d/%m/%Y'), '-') AS tgl_kirim_diminta,
                COALESCE(pba.allocated_qty, d.base_qty, 0) AS kuantitas_po,
                COALESCE(b.batch_number, '-') AS kode_batch,
                IF(b.plan_production_date IS NOT NULL, DATE_FORMAT(b.plan_production_date, '%d/%m/%Y'), '-') AS tgl_produksi,
                COALESCE(pba.fulfilled_qty, 0) AS hasil_produksi,
                (COALESCE(pba.allocated_qty, d.base_qty, 0) - COALESCE(pba.fulfilled_qty, 0)) AS sisa_po,
                IF(pba.status IS NOT NULL, UPPER(pba.status), '-') AS status_alokasi
            FROM sipuro_db.po_headers h
            JOIN sipuro_db.po_details d ON h.po_header_id = d.po_header_id
            JOIN sipuro_db.products p ON d.id_product = p.id_product
            LEFT JOIN sipuro_db.po_batch_allocations pba ON d.po_detail_id = pba.po_detail_id
            LEFT JOIN sipuro_db.batches b ON pba.id_batch = b.id
            ${whereSql}
            ORDER BY h.created_at DESC, p.product_code ASC;
        `;

        const [rows] = await sipuroDb.query(query, queryParams);

        const excelData = [];

        // BARIS PERTAMA: Header Kolom
        excelData.push([
            'ID Produk',
            'Nama Produk',
            'Kode PO',
            'Tgl PO Dibuat',
            'Tgl Kirim Diminta',
            'Kuantitas PO (PCS)',
            'Kode Batch',
            'Tgl Produksi',
            'Hasil Produksi (PCS)',
            'Sisa PO (PCS)',
            'Status'
        ]);

        // Baris Data
        rows.forEach(row => {
            excelData.push([
                row.id_produk || '-',
                row.nama_produk || '-',
                row.kode_po || '-',
                row.tgl_po_dibuat || '-',
                row.tgl_kirim_diminta || '-',
                Number(row.kuantitas_po) || 0,
                row.kode_batch,
                row.tgl_produksi,
                Number(row.hasil_produksi) || 0,
                Number(row.sisa_po) || 0,
                row.status_alokasi || '-'
            ]);
        });

        const worksheet = XLSX.utils.aoa_to_sheet(excelData);

        worksheet['!cols'] = [
            { wch: 18 },
            { wch: 45 },
            { wch: 22 },
            { wch: 16 },
            { wch: 18 },
            { wch: 20 },
            { wch: 20 },
            { wch: 16 },
            { wch: 22 },
            { wch: 16 },
            { wch: 12 }
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Export Batch');

        // Render buffer file xlsx secara presisi
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        const filename = `Export_Batch_${new Date().toISOString().split('T')[0]}.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', buffer.length);

        return res.status(200).end(buffer);

    } catch (error) {
        console.error('Export Excel Error:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengekspor data Excel.',
            error: error.message
        });
    }
};
