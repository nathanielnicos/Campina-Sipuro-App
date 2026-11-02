import React from 'react';
import QtyStack from '../../common/QtyStack';
import ProductCell from './ProductCell';
import { formatDateTime } from '../../../utils/dateHelper';
import { cellStyle, rowStyle, emptyRow } from './doRowStyles';

export const DETAIL_COLUMN_COUNT = 5;

/**
 * Tampilan DO Number - Per Lot: satu baris per (DO, item, lot).
 * Nomor DO hanya di baris pertama tiap DO, produk hanya di baris pertama tiap item.
 */
const DoDetailRows = ({ mappingList }) => {
    if (!mappingList || mappingList.length === 0) {
        return emptyRow(DETAIL_COLUMN_COUNT, 'No Delivery Order data available.');
    }

    return mappingList.flatMap((order) => {
        let firstOfOrder = true;
        return (Array.isArray(order.items) ? order.items : []).flatMap((item) => (
            (Array.isArray(item.lots) ? item.lots : []).map((lot, lotIdx) => {
                const showDo = firstOfOrder;
                firstOfOrder = false;
                return (
                    <tr key={`${order.delivery_order_id}-${item.id_product}-${lot.lot_number}`} style={rowStyle}>
                        <td style={{ ...cellStyle, fontWeight: 'bold', whiteSpace: 'nowrap' }}>{showDo ? order.do_number : ''}</td>
                        <td style={{ ...cellStyle, whiteSpace: 'nowrap', fontSize: '12px' }}>{formatDateTime(lot.date_time)}</td>
                        <td style={{ ...cellStyle, minWidth: '220px' }}>
                            {lotIdx === 0 && <ProductCell code={item.product_code} name={item.product_name} />}
                        </td>
                        <td style={{ ...cellStyle, fontFamily: 'monospace', fontWeight: '600', whiteSpace: 'nowrap' }}>{lot.lot_number}</td>
                        <td style={{ ...cellStyle, width: '120px' }}>
                            <QtyStack pcs={lot.qty_pcs} ctn={lot.qty_ctn} color="#198754" />
                        </td>
                    </tr>
                );
            })
        ));
    });
};

export default DoDetailRows;
