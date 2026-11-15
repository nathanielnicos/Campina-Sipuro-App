import React from 'react';
import QtyStack from '../../common/QtyStack';
import ProductCell from './ProductCell';
import DoDateCell from './DoDateCell';
import EstimatedPoCell from './EstimatedPoCell';
import { markChanges, returnDates } from './doRowGrouping';
import { cellStyle, rowStyle, emptyRow } from './doRowStyles';

export const RETURN_COLUMN_COUNT = 5;

/**
 * Tampilan Return Number - Per Lot: satu baris per (retur, item, lot). Retur terikat ke lot, bukan ke DO atau PO.
 * Nomor retur dan tanggal retur (paling awal) hanya di baris pertama tiap nomor retur, produk hanya saat berganti.
 * Bila retur punya beberapa tanggal, tanggal diberi penanda "+N" (tooltip: tanggal dan lot-nya).
 * Kolom Estimated PO (bila dinyalakan): PO yang dilepas retur itu, per (retur, item, lot); bila satu lot muncul pada
 * lebih dari satu baris di retur yang sama, perkiraan hanya di baris pertamanya agar tidak terhitung dua kali.
 */
const DoReturnViewRows = ({ mappingList, estimate }) => {
    const showEstimate = Boolean(estimate && estimate.enabled);
    if (!mappingList || mappingList.length === 0) {
        return emptyRow(RETURN_COLUMN_COUNT + (showEstimate ? 1 : 0), 'No return data available.');
    }

    const showReturn = markChanges(mappingList.map((row) => ({ group: row.return_number, value: '' })));
    const showProduct = markChanges(mappingList.map((row) => ({ group: row.return_number, value: row.product_code })));
    const datesOf = returnDates(mappingList);
    const seenLots = new Set();

    return mappingList.map((row, idx) => {
        const lotKey = `${row.return_number}\u0000${row.id_product}\u0000${row.lot_number}`;
        const firstOfLot = !seenLots.has(lotKey);
        seenLots.add(lotKey);
        return (
            <tr key={row.return_id} style={rowStyle}>
                <td style={{ ...cellStyle, fontWeight: 'bold', whiteSpace: 'nowrap' }}>{showReturn[idx] ? row.return_number : ''}</td>
                <td style={{ ...cellStyle, whiteSpace: 'nowrap', fontSize: '12px' }}>{showReturn[idx] ? <DoDateCell dates={datesOf.get(row.return_number)} /> : ''}</td>
                <td style={{ ...cellStyle, minWidth: '220px' }}>
                    {showProduct[idx] && <ProductCell code={row.product_code} name={row.product_name} />}
                </td>
                <td style={{ ...cellStyle, fontFamily: 'monospace', fontWeight: '600', whiteSpace: 'nowrap' }}>{row.lot_number}</td>
                <td style={{ ...cellStyle, width: '120px' }}>
                    <QtyStack pcs={row.qty_pcs} ctn={row.qty_ctn} color="#dc3545" />
                </td>
                {showEstimate && (
                    <td style={{ ...cellStyle, minWidth: '200px' }}>
                        {firstOfLot
                            ? <EstimatedPoCell variant="RETURN" estimate={estimate} entry={estimate.getLot(row.return_number, row.id_product, row.lot_number)} />
                            : <span style={{ color: '#6c757d', fontSize: '12px' }} title="Included in the first row of this lot in this return">↑</span>}
                    </td>
                )}
            </tr>
        );
    });
};

export default DoReturnViewRows;
