import React from 'react';
import ProductCell from './ProductCell';
import { formatDate, formatDateTime } from '../../../utils/dateHelper';
import { formatQty, formatCtn } from '../../../utils/formatters';
import { cellStyle, rowStyle, emptyRow } from './doRowStyles';

export const LOT_COLUMN_COUNT = 8;

const GREEN = '#198754';
const RED = '#dc3545';

const signOf = (value) => (value < 0 ? '-' : '+');

const badgeBase = {
    display: 'inline-block',
    marginTop: '4px',
    padding: '1px 6px',
    fontSize: '10px',
    fontWeight: 'normal',
    fontFamily: 'sans-serif',
    borderRadius: '8px',
    whiteSpace: 'nowrap'
};
const unallocatedStyle = { ...badgeBase, backgroundColor: '#fff3cd', color: '#664d03', border: '1px solid #ffecb5' };
const remainingStyle = { ...badgeBase, backgroundColor: '#e7f1ff', color: '#084298', border: '1px solid #b6d4fe' };
const emptyStyle = { ...badgeBase, backgroundColor: '#e9ecef', color: '#495057', border: '1px solid #dee2e6' };
const minusStyle = { ...badgeBase, backgroundColor: '#f8d7da', color: '#842029', border: '1px solid #f5c2c7' };

const returnTagStyle = {
    marginLeft: '6px',
    padding: '1px 6px',
    fontSize: '10px',
    borderRadius: '8px',
    backgroundColor: '#d1e7dd',
    color: '#0f5132',
    border: '1px solid #badbcc',
    whiteSpace: 'nowrap'
};

const lotHeaderRowStyle = { ...rowStyle, backgroundColor: '#f8f9fa', borderTop: '2px solid #dee2e6' };

// Qty dua baris seperti QtyStack, tetapi dengan tanda + / - (Qty Lot dan retur positif, DO negatif)
const SignedQty = ({ pcs, ctn }) => {
    const color = pcs < 0 ? RED : GREEN;
    const hasCtn = Math.abs(Number(ctn)) > 0;
    return (
        <div style={{ textAlign: 'right', lineHeight: '1.3' }}>
            <div style={{ fontWeight: 'bold', color }}>{signOf(pcs)}{formatQty(Math.abs(pcs))}</div>
            <div data-testid="qty-ctn" style={{ fontSize: '11px', color: '#868e96', marginTop: '2px' }}>
                {hasCtn ? `${signOf(ctn)}${formatCtn(Math.abs(ctn))} CTN` : '-'}
            </div>
        </div>
    );
};

// Saldo sesudah baris; baris terakhir kelompok (= Sisa lot) ditebalkan, baris sebelumnya diredupkan
const Balance = ({ pcs, ctn, isFinal }) => {
    const hasCtn = Number(ctn) !== 0;
    return (
        <div style={{ textAlign: 'right', lineHeight: '1.3' }}>
            <div style={{ fontWeight: isFinal ? 'bold' : 'normal', color: pcs < 0 ? RED : (isFinal ? '#212529' : '#6c757d') }}>{formatQty(pcs)}</div>
            <div data-testid="qty-ctn" style={{ fontSize: '11px', color: '#868e96', marginTop: '2px' }}>
                {hasCtn ? `${formatCtn(ctn)} CTN` : '-'}
            </div>
        </div>
    );
};

// Penanda Sisa lot (saldo akhir) di bawah nomor lot: level lot, terpisah dari saldo per baris
const RemainingBadge = ({ row }) => {
    if (row.lot_balance_pcs < 0) return <div><span style={minusStyle}>Lot balance negative: {formatQty(row.lot_balance_pcs)}</span></div>;
    if (row.lot_balance_pcs === 0) return <div><span style={emptyStyle}>Out of stock</span></div>;
    return <div><span style={remainingStyle}>Lot remaining: {formatQty(row.lot_balance_pcs)}</span></div>;
};

/**
 * Tampilan Lot Number sebagai kartu stok (ledger) per lot.
 * Tiap lot diawali satu baris pembuka (latar abu-abu): data lot dan Qty Lot (produksi, +), diikuti baris DO (-) dan
 * retur (+). Kolom Saldo adalah saldo sesudah baris itu; baris terakhir sama dengan "Sisa lot" pada penanda di bawah
 * nomor lot. Lot tanpa DO hanya punya baris pembuka. Lot tanpa alokasi PO diberi penanda "Not allocated" (mis. rework).
 */
const DoLotViewRows = ({ mappingList }) => {
    if (!mappingList || mappingList.length === 0) {
        return emptyRow(LOT_COLUMN_COUNT, 'No lot data available.');
    }

    return mappingList.map((row, idx) => {
        const next = idx < mappingList.length - 1 ? mappingList[idx + 1] : null;
        const isFinal = !next || next.entry_type === 'LOT';

        if (row.entry_type === 'LOT') {
            return (
                <tr key={`LOT-${row.lot_number}-${row.id_product}`} style={lotHeaderRowStyle}>
                    <td style={{ ...cellStyle, fontWeight: 'bold', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                        {row.lot_number}
                        <RemainingBadge row={row} />
                        {row.is_unallocated && (
                            <div>
                                <span
                                    style={unallocatedStyle}
                                    title="This lot has production quantity but no PO allocation (for example a rework lot). Check before shipping."
                                >
                                    Not allocated
                                </span>
                            </div>
                        )}
                    </td>
                    <td style={{ ...cellStyle, minWidth: '220px' }}>
                        <ProductCell code={row.product_code} name={row.product_name} />
                    </td>
                    <td style={{ ...cellStyle, whiteSpace: 'nowrap', fontSize: '12px' }}>{formatDateTime(row.actual_completed_datetime)}</td>
                    <td style={{ ...cellStyle, whiteSpace: 'nowrap', fontSize: '12px' }}>{formatDate(row.expired_date)}</td>
                    <td colSpan={2} style={{ ...cellStyle, fontStyle: 'italic', color: '#6c757d', whiteSpace: 'nowrap' }}>
                        Qty Lot (production)
                    </td>
                    <td style={{ ...cellStyle, width: '120px' }}>
                        <SignedQty pcs={row.signed_qty_pcs} ctn={row.signed_qty_ctn} />
                    </td>
                    <td style={{ ...cellStyle, width: '120px' }}>
                        <Balance pcs={row.balance_pcs} ctn={row.balance_ctn} isFinal={isFinal} />
                    </td>
                </tr>
            );
        }

        const isReturn = row.entry_type === 'RETURN';
        return (
            <tr key={`${row.entry_type}-${row.entry_id}-${row.lot_number}-${row.id_product}`} style={rowStyle}>
                <td style={cellStyle} />
                <td style={cellStyle} />
                <td style={cellStyle} />
                <td style={cellStyle} />
                <td style={{ ...cellStyle, fontWeight: '600', whiteSpace: 'nowrap' }}>
                    {row.entry_number}
                    {isReturn && <span style={returnTagStyle}>Return</span>}
                </td>
                <td style={{ ...cellStyle, whiteSpace: 'nowrap', fontSize: '12px' }}>{formatDateTime(row.entry_datetime)}</td>
                <td style={{ ...cellStyle, width: '120px' }}>
                    <SignedQty pcs={row.signed_qty_pcs} ctn={row.signed_qty_ctn} />
                </td>
                <td style={{ ...cellStyle, width: '120px' }}>
                    <Balance pcs={row.balance_pcs} ctn={row.balance_ctn} isFinal={isFinal} />
                </td>
            </tr>
        );
    });
};

export default DoLotViewRows;
