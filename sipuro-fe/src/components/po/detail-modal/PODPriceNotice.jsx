import { formatCurrency } from '../../../utils/formatters';

/**
 * Pemberitahuan harga untuk PO berstatus Draft (diperlakukan seperti keranjang):
 * harga Draft selalu mengikuti harga yang berlaku hari ini saat disimpan atau diajukan.
 */
const PODPriceNotice = ({ items = [] }) => {
    const changedItems = items.filter((item) => item.price_changed);
    const unavailableItems = items.filter((item) => item.price_unavailable);

    if (changedItems.length === 0 && unavailableItems.length === 0) {
        return null;
    }

    const listStyle = { margin: '6px 0 0', paddingLeft: '20px' };

    return (
        <div style={{ marginBottom: '12px' }}>
            {changedItems.length > 0 && (
                <div style={{
                    padding: '10px 14px',
                    marginBottom: '8px',
                    borderRadius: '6px',
                    border: '1px solid #ffe69c',
                    backgroundColor: '#fff3cd',
                    color: '#664d03',
                    fontSize: '13px'
                }}>
                    Prices for {changedItems.length} item(s) have changed since this draft was last saved.
                    Totals shown use the current prices.
                    <ul style={listStyle}>
                        {changedItems.map((item) => (
                            <li key={item.row_id}>
                                {item.product_name}: {formatCurrency(item.old_unit_price)} → <strong>{formatCurrency(item.unit_price)}</strong>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {unavailableItems.length > 0 && (
                <div style={{
                    padding: '10px 14px',
                    borderRadius: '6px',
                    border: '1px solid #f5c2c7',
                    backgroundColor: '#f8d7da',
                    color: '#842029',
                    fontSize: '13px'
                }}>
                    Some products are no longer available. Please remove them before saving.
                    <ul style={listStyle}>
                        {unavailableItems.map((item) => (
                            <li key={item.row_id}>{item.product_name}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default PODPriceNotice;
