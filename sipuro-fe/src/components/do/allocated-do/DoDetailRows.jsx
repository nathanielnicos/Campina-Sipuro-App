import React from 'react';
import QtyStack from '../../common/QtyStack';
import ProductCell from './ProductCell';
import EstimatedPoCell from './EstimatedPoCell';
import DoDateCell from './DoDateCell';
import { markChanges, summarizeDates } from './doRowGrouping';
import { cellStyle, rowStyle, emptyRow } from './doRowStyles';

export const DETAIL_COLUMN_COUNT = 5;

/**
 * Tampilan DO Number - Per Lot: satu baris per (DO, item, lot).
 * Nomor DO dan tanggal DO (paling awal) hanya di baris pertama tiap DO, produk hanya saat berganti.
 * Bila DO dikirim pada beberapa waktu, tanggal diberi penanda "+N" (tooltip: tanggal dan lot-nya).
 */
const DoDetailRows = ({ mappingList, estimate }) => {
    const showEstimate = Boolean(estimate && estimate.enabled);
    const entries = (mappingList || []).flatMap((order) => (Array.isArray(order.items) ? order.items : []).flatMap((item) => (
        (Array.isArray(item.lots) ? item.lots : []).map((lot) => ({ order, item, lot }))
    )));
    if (entries.length === 0) {
        return emptyRow(DETAIL_COLUMN_COUNT + (showEstimate ? 1 : 0), 'No Delivery Order data available.');
    }

    const showDo = markChanges(entries.map((e) => ({ group: e.order.delivery_order_id, value: '' })));
    const showProduct = markChanges(entries.map((e) => ({ group: e.order.delivery_order_id, value: e.item.id_product })));
    const datesOf = new Map((mappingList || []).map((order) => [order.delivery_order_id, summarizeDates(
        (Array.isArray(order.items) ? order.items : []).flatMap((item) => (Array.isArray(item.lots) ? item.lots : []).map((lot) => ({ date: lot.date_time, label: lot.lot_number }))),
        order.do_datetime
    )]));

    return entries.map(({ order, item, lot }, idx) => (
        <tr key={`${order.delivery_order_id}-${item.id_product}-${lot.lot_number}`} style={rowStyle}>
            <td style={{ ...cellStyle, fontWeight: 'bold', whiteSpace: 'nowrap' }}>{showDo[idx] ? order.do_number : ''}</td>
            <td style={{ ...cellStyle, whiteSpace: 'nowrap', fontSize: '12px' }}>{showDo[idx] ? <DoDateCell dates={datesOf.get(order.delivery_order_id)} /> : ''}</td>
            <td style={{ ...cellStyle, minWidth: '220px' }}>
                {showProduct[idx] && <ProductCell code={item.product_code} name={item.product_name} />}
            </td>
            <td style={{ ...cellStyle, fontFamily: 'monospace', fontWeight: '600', whiteSpace: 'nowrap' }}>{lot.lot_number}</td>
            <td style={{ ...cellStyle, width: '120px' }}>
                <QtyStack pcs={lot.qty_pcs} ctn={lot.qty_ctn} color="#198754" />
            </td>
            {showEstimate && (
                <td style={{ ...cellStyle, minWidth: '200px' }}>
                    <EstimatedPoCell estimate={estimate} entry={estimate.getLot(order.delivery_order_id, item.id_product, lot.lot_number)} />
                </td>
            )}
        </tr>
    ));
};

export default DoDetailRows;
