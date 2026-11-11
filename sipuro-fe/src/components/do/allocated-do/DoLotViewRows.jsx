import React from 'react';
import ProductCell from './ProductCell';
import { formatDate, formatDateTime } from '../../../utils/dateHelper';
import { formatQty, formatCtn } from '../../../utils/formatters';
import { cellStyle, rowStyle, emptyRow } from './doRowStyles';

export const LOT_COLUMN_COUNT = 9;

const GREEN = '#198754';
const RED = '#dc3545';

const signOf = (value) => (value < 0 ? '-' : '+');

const unallocatedStyle = {
    display: 'inline-block',
    marginTop: '4px',
    padding: '1px 6px',
    fontSize: '10px',
    fontWeight: 'normal',
    fontFamily: 'sans-serif',
    borderRadius: '8px',
    backgroundColor: '#fff3cd',
    color: '#664d03',
    border: '1px solid #ffecb5',
    whiteSpace: 'nowrap'
};

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

// Qty dua baris seperti QtyStack, tetapi dengan tanda + / - (DO negatif, retur positif)
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

// Qty tanpa tanda (Qty Lot dan Sisa); minus tampil merah
const PlainQty = ({ pcs, ctn }) => {
    const hasCtn = Number(ctn) !== 0;
    return (
        <div style={{ textAlign: 'right', lineHeight: '1.3' }}>
            <div style={{ fontWeight: 'bold', color: pcs < 0 ? RED : '#212529' }}>{formatQty(pcs)}</div>
            <div data-testid="qty-ctn" style={{ fontSize: '11px', color: '#868e96', marginTop: '2px' }}>
                {hasCtn ? `${formatCtn(ctn)} CTN` : '-'}
            </div>
        </div>
    );
};

/**
 * Tampilan Lot Number (buku besar lot): satu baris per transaksi (DO atau retur) pada sebuah lot.
 * Data lot (nomor lot, produk, tanggal selesai, exp date, Qty Lot) hanya di baris pertama tiap lot / produk.
 * DO tampil negatif, retur positif; Sisa = saldo lot sesudah transaksi itu (Qty Lot - DO + retur).
 * Lot tanpa alokasi PO diberi penanda "Not allocated" (mis. lot rework): periksa sebelum dikirim.
 */
const DoLotViewRows = ({ mappingList }) => {
    if (!mappingList || mappingList.length === 0) {
        return emptyRow(LOT_COLUMN_COUNT, 'No lot shipment data available.');
    }

    return mappingList.map((row, idx) => {
        const prev = idx > 0 ? mappingList[idx - 1] : null;
        const newLot = !prev || prev.lot_number !== row.lot_number;
        const newProduct = newLot || prev.id_product !== row.id_product;
        const isReturn = row.entry_type === 'RETURN';

        return (
            <tr key={`${row.entry_type}-${row.entry_id}-${row.lot_number}-${row.id_product}`} style={rowStyle}>
                <td style={{ ...cellStyle, fontWeight: 'bold', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                    {newLot ? row.lot_number : ''}
                    {newProduct && row.is_unallocated && (
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
                    {newProduct && <ProductCell code={row.product_code} name={row.product_name} />}
                </td>
                <td style={{ ...cellStyle, whiteSpace: 'nowrap', fontSize: '12px' }}>{newProduct ? formatDateTime(row.actual_completed_datetime) : ''}</td>
                <td style={{ ...cellStyle, whiteSpace: 'nowrap', fontSize: '12px' }}>{newProduct ? formatDate(row.expired_date) : ''}</td>
                <td style={{ ...cellStyle, fontWeight: '600', whiteSpace: 'nowrap' }}>
                    {row.entry_number}
                    {isReturn && <span style={returnTagStyle}>Return</span>}
                </td>
                <td style={{ ...cellStyle, whiteSpace: 'nowrap', fontSize: '12px' }}>{formatDateTime(row.entry_datetime)}</td>
                <td style={{ ...cellStyle, width: '120px' }}>
                    <SignedQty pcs={row.signed_qty_pcs} ctn={row.signed_qty_ctn} />
                </td>
                <td style={{ ...cellStyle, width: '120px' }}>
                    {newProduct && <PlainQty pcs={row.qty_lot} ctn={row.qty_lot_ctn} />}
                </td>
                <td style={{ ...cellStyle, width: '120px' }}>
                    <PlainQty pcs={row.balance_pcs} ctn={row.balance_ctn} />
                </td>
            </tr>
        );
    });
};

export default DoLotViewRows;
