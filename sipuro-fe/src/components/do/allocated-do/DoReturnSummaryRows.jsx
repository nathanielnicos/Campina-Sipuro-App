import React from 'react';
import QtyStack from '../../common/QtyStack';
import ProductCell from './ProductCell';
import DoDateCell from './DoDateCell';
import { markChanges, returnDates } from './doRowGrouping';
import { cellStyle, rowStyle, emptyRow } from './doRowStyles';

export const RETURN_SUMMARY_COLUMN_COUNT = 4;

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Menggabungkan baris retur (retur, item, lot) menjadi satu baris per (nomor retur, produk).
 * Halaman memuat seluruh baris tiap nomor retur (paginasi per nomor retur), jadi jumlahnya lengkap.
 */
export const groupReturnsByProduct = (rows) => {
    const groups = new Map();
    (rows || []).forEach((row) => {
        const key = `${row.return_number}\u0000${row.product_code}`;
        let group = groups.get(key);
        if (!group) {
            group = { key, return_number: row.return_number, product_code: row.product_code, product_name: row.product_name, qty_pcs: 0, qty_ctn: 0 };
            groups.set(key, group);
        }
        group.qty_pcs += Number(row.qty_pcs) || 0;
        group.qty_ctn = round2(group.qty_ctn + (Number(row.qty_ctn) || 0));
    });
    return [...groups.values()];
};

/**
 * Tampilan Return Number - Summary: satu baris per (retur, produk), qty = total semua lot produk itu.
 * Nomor retur dan tanggal retur (paling awal) hanya di baris pertama tiap nomor retur; bila retur punya beberapa
 * tanggal, tanggal diberi penanda "+N" (tooltip: tanggal dan lot-nya).
 */
const DoReturnSummaryRows = ({ mappingList }) => {
    const groups = groupReturnsByProduct(mappingList);
    if (groups.length === 0) {
        return emptyRow(RETURN_SUMMARY_COLUMN_COUNT, 'No return data available.');
    }

    const showReturn = markChanges(groups.map((g) => ({ group: g.return_number, value: '' })));
    const datesOf = returnDates(mappingList);

    return groups.map((g, idx) => (
        <tr key={g.key} style={rowStyle}>
            <td style={{ ...cellStyle, fontWeight: 'bold', whiteSpace: 'nowrap' }}>{showReturn[idx] ? g.return_number : ''}</td>
            <td style={{ ...cellStyle, whiteSpace: 'nowrap', fontSize: '12px' }}>{showReturn[idx] ? <DoDateCell dates={datesOf.get(g.return_number)} /> : ''}</td>
            <td style={{ ...cellStyle, minWidth: '220px' }}>
                <ProductCell code={g.product_code} name={g.product_name} />
            </td>
            <td style={{ ...cellStyle, width: '120px' }}>
                <QtyStack pcs={g.qty_pcs} ctn={g.qty_ctn} color="#dc3545" />
            </td>
        </tr>
    ));
};

export default DoReturnSummaryRows;
