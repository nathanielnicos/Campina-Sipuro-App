import React from 'react';
import { formatCurrency } from '../../../utils/formatters';

const POSummary = ({ subtotal, ppnPercent, taxAmount, grandTotal, userRole }) => {
    // Jika role adalah PPIC, jangan tampilkan ringkasan harga apapun
    if (userRole === 'PPIC') {
        return null;
    }

    return (
        <div style={{ textAlign: 'right', marginBottom: '20px', fontSize: '14px' }}>
            <p style={{ margin: '4px 0' }}>Subtotal: <strong>{formatCurrency(subtotal)}</strong></p>
            <p style={{ margin: '4px 0' }}>
                PPN ({ppnPercent !== null ? `${ppnPercent}%` : 'Loading...'}): {" "}
                <strong>{formatCurrency(taxAmount)}</strong>
            </p>
            <h3 style={{ margin: '8px 0', color: '#007bff' }}>Grand Total: {formatCurrency(grandTotal)}</h3>
        </div>
    );
};

export default POSummary;
