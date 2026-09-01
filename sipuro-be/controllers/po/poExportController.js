const XLSX = require('xlsx');
const { sipuroDb } = require('../../config/db');

exports.exportPoExcel = async (req, res) => {
    try {
        const { customer_id, search, status, startDate, endDate } = req.query;

        let query = `
            SELECT 
                ph.po_number,
                DATE_FORMAT(ph.created_at, '%Y-%m-%d') AS created_at,
                DATE_FORMAT(ph.requested_delivery_date, '%Y-%m-%d') AS requested_delivery_date,
                ph.status,
                ph.delivery_address,
                ph.description,
                ph.ppn_percent,
                p.product_name,
                pd.base_price,
                pd.total_price,
                pd.base_qty
            FROM sipuro_db.po_headers ph
            JOIN sipuro_db.po_details pd ON ph.po_header_id = pd.po_header_id
            LEFT JOIN sipuro_db.customers c ON ph.customer_id = c.customer_id
            LEFT JOIN sipuro_db.products p ON pd.id_product = p.id_product
            WHERE pd.deleted_at IS NULL
        `;

        const params = [];

        if (customer_id && customer_id !== 'null' && customer_id !== 'undefined') {
            query += ` AND ph.customer_id = ?`;
            params.push(customer_id);
        }
        if (search && search.trim() !== '') {
            query += ` AND (ph.po_number LIKE ? OR p.product_name LIKE ?)`;
            params.push(`%${search.trim()}%`, `%${search.trim()}%`);
        }
        if (status && status !== '') {
            query += ` AND ph.status = ?`;
            params.push(status);
        }
        if (startDate && startDate !== '') {
            query += ` AND DATE(ph.created_at) >= ?`;
            params.push(startDate);
        }
        if (endDate && endDate !== '') {
            query += ` AND DATE(ph.created_at) <= ?`;
            params.push(endDate);
        }

        query += ` ORDER BY ph.po_header_id DESC`;

        const [rows] = await sipuroDb.query(query, params);

        const excelData = [
            [
                'Kode PO',
                'Tanggal Dibuat',
                'Tanggal Kirim Diminta',
                'Status',
                'Alamat Pengiriman',
                'Catatan',
                'Nama Produk',
                'Harga per Satuan Dasar',
                'Kuantitas dalam Satuan Dasar',
                'Total Tidak Termasuk PPN',
                'PPN',
                'Total Termasuk PPN'
            ]
        ];

        rows.forEach((item) => {
            const baseQty = Number(item.base_qty) || 0;
            const basePrice = Number(item.base_price) || 0;
            const ppnPercent = Number(item.ppn_percent) || 0; // Ambil nilai PPN dinamis dari database

            // Hitung subtotal per item
            const totalExclPpn = Number(item.total_price) || (basePrice * baseQty);
            const ppnAmount = totalExclPpn * (ppnPercent / 100);
            const totalInclPpn = totalExclPpn + ppnAmount;

            // Perhitungan harga per 1 satuan dasar
            const baseUnitPrice = baseQty > 0 ? totalExclPpn / baseQty : basePrice;

            excelData.push([
                item.po_number,
                item.created_at,
                item.requested_delivery_date,
                item.status,
                item.delivery_address || '',
                item.description || '',
                item.product_name,
                baseUnitPrice,
                baseQty,
                totalExclPpn,
                ppnAmount,
                totalInclPpn
            ]);
        });

        const worksheet = XLSX.utils.aoa_to_sheet(excelData);

        worksheet['!cols'] = [
            { wch: 20 },
            { wch: 16 },
            { wch: 22 },
            { wch: 26 },
            { wch: 50 },
            { wch: 25 },
            { wch: 45 },
            { wch: 24 },
            { wch: 28 },
            { wch: 25 },
            { wch: 16 },
            { wch: 22 }
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

        const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Rekap_PO_${Date.now()}.xlsx`);

        return res.send(buffer);
    } catch (error) {
        console.error('Error exporting PO Excel:', error);
        return res.status(500).json({ success: false, message: 'Gagal mengeksport data Excel.', error: error.message });
    }
};
