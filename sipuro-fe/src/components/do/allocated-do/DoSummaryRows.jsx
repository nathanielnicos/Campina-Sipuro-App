import React from 'react';
import QtyStack from '../../common/QtyStack';
import ProductCell from './ProductCell';
import EstimatedPoCell from './EstimatedPoCell';
import { formatDateTime } from '../../../utils/dateHelper';
import { cellStyle, rowStyle, emptyRow } from './doRowStyles';

export const SUMMARY_COLUMN_COUNT = 4;

/**
 * Tampilan DO Number - Summary: satu baris per (DO, item), qty = total semua lot item itu.
 * Nomor DO dan tanggal hanya di baris pertama tiap DO.
 */
const DoSummaryRows = ({ mappingList, estimate }) => {
    const showEstimate = Boolean(estimate && estimate.enabled);
    if (!mappingList || mappingList.length === 0) {
        return emptyRow(SUMMARY_COLUMN_COUNT + (showEstimate ? 1 : 0), 'No Delivery Order data available.');
    }

    return mappingList.flatMap((order) => (Array.isArray(order.items) ? order.items : []).map((item, itemIdx) => (
        <tr key={`${order.delivery_order_id}-${item.id_product}`} style={rowStyle}>
            <td style={{ ...cellStyle, fontWeight: 'bold', whiteSpace: 'nowrap' }}>{itemIdx === 0 ? order.do_number : ''}</td>
            <td style={{ ...cellStyle, whiteSpace: 'nowrap', fontSize: '12px' }}>{itemIdx === 0 ? formatDateTime(order.do_datetime) : ''}</td>
            <td style={{ ...cellStyle, minWidth: '220px' }}>
                <ProductCell code={item.product_code} name={item.product_name} />
            </td>
            <td style={{ ...cellStyle, width: '120px' }}>
                <QtyStack pcs={item.total_qty_pcs} ctn={item.total_qty_ctn} color="#198754" />
            </td>
            {showEstimate && (
                <td style={{ ...cellStyle, minWidth: '200px' }}>
                    <EstimatedPoCell estimate={estimate} entry={estimate.getItem(order.delivery_order_id, item.id_product)} />
                </td>
            )}
        </tr>
    )));
};

export default DoSummaryRows;
