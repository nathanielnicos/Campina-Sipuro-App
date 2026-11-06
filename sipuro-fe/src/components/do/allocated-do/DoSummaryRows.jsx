import React from 'react';
import QtyStack from '../../common/QtyStack';
import ProductCell from './ProductCell';
import EstimatedPoCell from './EstimatedPoCell';
import DoDateCell from './DoDateCell';
import { markChanges, summarizeDates } from './doRowGrouping';
import { cellStyle, rowStyle, emptyRow } from './doRowStyles';

export const SUMMARY_COLUMN_COUNT = 4;

/**
 * Tampilan DO Number - Summary: satu baris per (DO, item), qty = total semua lot item itu.
 * Nomor DO hanya di baris pertama tiap DO. Tanggal hanya bila berbeda dari baris sebelumnya dalam DO yang sama;
 * bila item dikirim pada beberapa waktu, tampil tanggal paling awal dengan penanda "+N".
 */
const DoSummaryRows = ({ mappingList, estimate }) => {
    const showEstimate = Boolean(estimate && estimate.enabled);
    const entries = (mappingList || []).flatMap((order) => (Array.isArray(order.items) ? order.items : []).map((item) => ({
        order,
        item,
        dates: summarizeDates((Array.isArray(item.lots) ? item.lots : []).map((lot) => lot.date_time).concat(item.lots && item.lots.length ? [] : [order.do_datetime]))
    })));
    if (entries.length === 0) {
        return emptyRow(SUMMARY_COLUMN_COUNT + (showEstimate ? 1 : 0), 'No Delivery Order data available.');
    }

    const showDo = markChanges(entries.map((e) => ({ group: e.order.delivery_order_id, value: '' })));
    const showDate = markChanges(entries.map((e) => ({ group: e.order.delivery_order_id, value: e.dates.key })));

    return entries.map(({ order, item, dates }, idx) => (
        <tr key={`${order.delivery_order_id}-${item.id_product}`} style={rowStyle}>
            <td style={{ ...cellStyle, fontWeight: 'bold', whiteSpace: 'nowrap' }}>{showDo[idx] ? order.do_number : ''}</td>
            <td style={{ ...cellStyle, minWidth: '220px' }}>
                <ProductCell code={item.product_code} name={item.product_name} />
            </td>
            <td style={{ ...cellStyle, whiteSpace: 'nowrap', fontSize: '12px' }}>{showDate[idx] ? <DoDateCell dates={dates} /> : ''}</td>
            <td style={{ ...cellStyle, width: '120px' }}>
                <QtyStack pcs={item.total_qty_pcs} ctn={item.total_qty_ctn} color="#198754" />
            </td>
            {showEstimate && (
                <td style={{ ...cellStyle, minWidth: '200px' }}>
                    <EstimatedPoCell estimate={estimate} entry={estimate.getItem(order.delivery_order_id, item.id_product)} />
                </td>
            )}
        </tr>
    ));
};

export default DoSummaryRows;
