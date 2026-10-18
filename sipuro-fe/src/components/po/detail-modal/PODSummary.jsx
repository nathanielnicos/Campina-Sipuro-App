import { formatCurrency } from '../../../utils/formatters';
import { AMOUNT_TOO_LARGE_MESSAGE } from '../../../utils/money';

const PODSummary = ({ subtotal, ppnPercent, taxAmount, grandTotal, userRole, isTooLarge = false }) => {
    if (userRole !== 'CUSTOMER') {
        return null;
    }

    return (
        <div style={{ textAlign: 'right', marginBottom: '20px', fontSize: '14px' }}>
            <p style={{ margin: '4px 0' }}>Subtotal: <strong>{formatCurrency(subtotal)}</strong></p>
            <p style={{ margin: '4px 0' }}>
                VAT ({ppnPercent !== null ? `${ppnPercent}%` : 'Loading...'}): {" "}
                <strong>{formatCurrency(taxAmount)}</strong>
            </p>
            <h3 style={{ margin: '8px 0', color: '#007bff' }}>Grand Total: {formatCurrency(grandTotal)}</h3>
            {isTooLarge && (
                <p style={{ margin: '4px 0', color: '#dc3545', fontWeight: 'bold' }}>{AMOUNT_TOO_LARGE_MESSAGE}</p>
            )}
        </div>
    );
};

export default PODSummary;
