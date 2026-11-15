import React from 'react';
import { formatQty } from '../../../utils/formatters';

const badgeStyle = {
    marginLeft: '6px',
    padding: '1px 6px',
    fontSize: '10px',
    borderRadius: '8px',
    backgroundColor: '#fff3cd',
    color: '#664d03',
    border: '1px solid #ffecb5',
    whiteSpace: 'nowrap'
};

const returnedStyle = { color: '#dc3545' };
const fromStyle = { color: '#6c757d', fontSize: '11px' };

/**
 * Perkiraan PO satu item / satu lot, dua jenis (prop `variant`):
 *  - 'DO'     : nomor PO + qty kirim (pcs); bila sebagian diretur: "returned N". "via mapping" bila kode produk PO
 *               berbeda dari kode DO. "Unassigned" = qty yang tidak tertutup alokasi PO mana pun.
 *  - 'RETURN' : PO yang kapasitasnya dilepas retur itu + qty, dengan DO asal perkiraan di bawahnya.
 *               "Unmatched" = qty retur yang tidak punya pengiriman sebelumnya (di data DO) pada lot itu.
 */
const EstimatedPoCell = ({ estimate, entry, variant = 'DO' }) => {
    if (estimate.error) return <span style={{ color: '#dc3545', fontSize: '12px' }}>-</span>;
    if (!entry) {
        return <span style={{ color: '#6c757d', fontSize: '12px' }}>{estimate.loading ? 'Loading...' : '-'}</span>;
    }

    const isReturn = variant === 'RETURN';
    const pos = Array.isArray(entry.pos) ? entry.pos : [];
    const unassigned = Number(entry.unassigned_qty) || 0;
    const unmatched = Number(entry.unmatched_qty) || 0;
    const unassignedReleased = Number(entry.unassigned_released_qty) || 0;
    // Retur DO yang memakai bagian tanpa PO: tidak tertempel pada PO mana pun, jadi ditampilkan terpisah
    const returnedWithoutPo = isReturn ? 0 : Math.max(0, (Number(entry.returned_qty) || 0) - pos.reduce((sum, po) => sum + (Number(po.returned_pcs) || 0), 0));
    if (pos.length === 0 && unassigned === 0 && unmatched === 0 && unassignedReleased === 0 && returnedWithoutPo === 0) {
        return <span style={{ color: '#6c757d', fontSize: '12px' }}>-</span>;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '12px' }}>
            {pos.map((po) => (
                <div key={po.po_detail_id}>
                    <div style={{ whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: '600' }}>{po.po_number}</span>
                        <span style={{ color: '#6c757d' }}> · {formatQty(po.qty_pcs)}</span>
                        {Number(po.returned_pcs) > 0 && (
                            <span style={returnedStyle} title="Quantity of this PO share that was returned"> · returned {formatQty(po.returned_pcs)}</span>
                        )}
                        {po.via_mapping && (
                            <span style={badgeStyle} title={`PO product code: ${po.po_product_code}`}>via mapping</span>
                        )}
                    </div>
                    {isReturn && Array.isArray(po.from) && po.from.length > 0 && (
                        <div style={fromStyle} title="Estimated: matched to the latest earlier delivery of this lot">
                            from {po.from.map((f) => `${f.do_number} (${formatQty(f.qty_pcs)})`).join(', ')}
                        </div>
                    )}
                </div>
            ))}
            {unassigned > 0 && (
                <div style={{ color: '#dc3545', whiteSpace: 'nowrap' }} title="Quantity not covered by any PO allocation of this lot">
                    Unassigned · {formatQty(unassigned)}
                </div>
            )}
            {returnedWithoutPo > 0 && (
                <div style={returnedStyle} title="This quantity was delivered beyond the PO allocation of the lot and has been returned">
                    Returned (no PO) · {formatQty(returnedWithoutPo)}
                </div>
            )}
            {unassignedReleased > 0 && (
                <div style={{ color: '#6c757d', whiteSpace: 'nowrap' }} title="Returned from delivery quantity that was not covered by any PO allocation">
                    Not tied to PO · {formatQty(unassignedReleased)}
                </div>
            )}
            {unmatched > 0 && (
                <div style={{ color: '#b45309', whiteSpace: 'nowrap' }} title="No earlier delivery of this lot in the DO data to match this return quantity">
                    Unmatched · {formatQty(unmatched)}
                </div>
            )}
        </div>
    );
};

export default EstimatedPoCell;
