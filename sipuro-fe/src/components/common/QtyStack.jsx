import React from 'react';
import { formatQty, formatCtn } from '../../utils/formatters';

/**
 * Qty dua baris: pcs di atas (tebal), konversi carton di bawah (kecil, abu-abu).
 * Carton 0 / kosong berarti produk belum punya pcs per carton, ditampilkan "-".
 */
const QtyStack = ({ pcs, ctn, align = 'right', color = '#212529' }) => {
    const hasCtn = Number(ctn) > 0;
    return (
        <div style={{ textAlign: align, lineHeight: '1.3' }}>
            <div style={{ fontWeight: 'bold', color }}>{formatQty(pcs)}</div>
            <div data-testid="qty-ctn" style={{ fontSize: '11px', color: '#868e96', marginTop: '2px' }}>
                {hasCtn ? `${formatCtn(ctn)} CTN` : '-'}
            </div>
        </div>
    );
};

export default QtyStack;
