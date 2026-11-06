import React from 'react';
import QtyStack from '../../common/QtyStack';
import ProductCell from './ProductCell';
import { formatDateTime } from '../../../utils/dateHelper';
import { markChanges } from './doRowGrouping';
import { cellStyle, rowStyle, emptyRow } from './doRowStyles';

export const RETURN_COLUMN_COUNT = 5;

/**
 * Tampilan Return Number - Per Lot: satu baris per (retur, item, lot). Retur terikat ke lot, bukan ke DO atau PO.
 * Nomor retur hanya di baris pertama tiap nomor retur, produk hanya saat berganti, tanggal hanya bila berbeda dari
 * baris sebelumnya dalam retur yang sama.
 */
const DoReturnViewRows = ({ mappingList }) => {
    if (!mappingList || mappingList.length === 0) {
        return emptyRow(RETURN_COLUMN_COUNT, 'No return data available.');
    }

    const showReturn = markChanges(mappingList.map((row) => ({ group: row.return_number, value: '' })));
    const showProduct = markChanges(mappingList.map((row) => ({ group: row.return_number, value: row.product_code })));
    const showDate = markChanges(mappingList.map((row) => ({ group: row.return_number, value: String(row.return_datetime) })));

    return mappingList.map((row, idx) => (
        <tr key={row.return_id} style={rowStyle}>
            <td style={{ ...cellStyle, fontWeight: 'bold', whiteSpace: 'nowrap' }}>{showReturn[idx] ? row.return_number : ''}</td>
            <td style={{ ...cellStyle, minWidth: '220px' }}>
                {showProduct[idx] && <ProductCell code={row.product_code} name={row.product_name} />}
            </td>
            <td style={{ ...cellStyle, whiteSpace: 'nowrap', fontSize: '12px' }}>{showDate[idx] ? formatDateTime(row.return_datetime) : ''}</td>
            <td style={{ ...cellStyle, fontFamily: 'monospace', fontWeight: '600', whiteSpace: 'nowrap' }}>{row.lot_number}</td>
            <td style={{ ...cellStyle, width: '120px' }}>
                <QtyStack pcs={row.qty_pcs} ctn={row.qty_ctn} color="#dc3545" />
            </td>
        </tr>
    ));
};

export default DoReturnViewRows;
