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

/**
 * Perkiraan PO satu item / satu lot: nomor PO + qty (pcs), penanda "via mapping" bila kode produk PO
 * berbeda dari kode DO, dan sisa qty yang tidak terhubung ke alokasi PO mana pun.
 */
const EstimatedPoCell = ({ estimate, entry }) => {
    if (estimate.error) return <span style={{ color: '#dc3545', fontSize: '12px' }}>-</span>;
    if (!entry) {
        return <span style={{ color: '#6c757d', fontSize: '12px' }}>{estimate.loading ? 'Loading...' : '-'}</span>;
    }

    const pos = Array.isArray(entry.pos) ? entry.pos : [];
    const unassigned = Number(entry.unassigned_qty) || 0;
    if (pos.length === 0 && unassigned === 0) return <span style={{ color: '#6c757d', fontSize: '12px' }}>-</span>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '12px' }}>
            {pos.map((po) => (
                <div key={po.po_detail_id} style={{ whiteSpace: 'nowrap' }}>
                    <span style={{ fontWeight: '600' }}>{po.po_number}</span>
                    <span style={{ color: '#6c757d' }}> · {formatQty(po.qty_pcs)}</span>
                    {po.via_mapping && (
                        <span style={badgeStyle} title={`PO product code: ${po.po_product_code}`}>via mapping</span>
                    )}
                </div>
            ))}
            {unassigned > 0 && (
                <div style={{ color: '#dc3545', whiteSpace: 'nowrap' }} title="Quantity not covered by any PO allocation of this lot">
                    Unassigned · {formatQty(unassigned)}
                </div>
            )}
        </div>
    );
};

export default EstimatedPoCell;
