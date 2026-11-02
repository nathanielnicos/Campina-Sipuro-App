import React from 'react';
import QtyStack from '../../common/QtyStack';
import ProductCell from './ProductCell';
import { formatDate, formatDateTime } from '../../../utils/dateHelper';
import { cellStyle, rowStyle, emptyRow } from './doRowStyles';

export const LOT_COLUMN_COUNT = 7;

/**
 * Tampilan Lot Number: satu baris per (lot, item, DO). Data lot (nomor lot, produk, tanggal selesai produksi,
 * exp date) hanya di baris pertama tiap lot / produk. Tanpa informasi PO.
 */
const DoLotViewRows = ({ mappingList }) => {
    if (!mappingList || mappingList.length === 0) {
        return emptyRow(LOT_COLUMN_COUNT, 'No lot shipment data available.');
    }

    return mappingList.map((row, idx) => {
        const prev = idx > 0 ? mappingList[idx - 1] : null;
        const newLot = !prev || prev.lot_number !== row.lot_number;
        const newProduct = newLot || prev.id_product !== row.id_product;

        return (
            <tr key={`${row.lot_number}-${row.id_product}-${row.delivery_order_id}`} style={rowStyle}>
                <td style={{ ...cellStyle, fontWeight: 'bold', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{newLot ? row.lot_number : ''}</td>
                <td style={{ ...cellStyle, minWidth: '220px' }}>
                    {newProduct && <ProductCell code={row.product_code} name={row.product_name} />}
                </td>
                <td style={{ ...cellStyle, whiteSpace: 'nowrap', fontSize: '12px' }}>{newProduct ? formatDateTime(row.actual_completed_datetime) : ''}</td>
                <td style={{ ...cellStyle, whiteSpace: 'nowrap', fontSize: '12px' }}>{newProduct ? formatDate(row.expired_date) : ''}</td>
                <td style={{ ...cellStyle, fontWeight: '600', whiteSpace: 'nowrap' }}>{row.do_number}</td>
                <td style={{ ...cellStyle, whiteSpace: 'nowrap', fontSize: '12px' }}>{formatDateTime(row.do_datetime)}</td>
                <td style={{ ...cellStyle, width: '120px' }}>
                    <QtyStack pcs={row.qty_pcs} ctn={row.qty_ctn} color="#198754" />
                </td>
            </tr>
        );
    });
};

export default DoLotViewRows;
