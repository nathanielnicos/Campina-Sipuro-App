import { formatQty } from '../../../utils/formatters';

const ConfirmCreatePOModal = ({
    isOpen,
    onClose,
    items,
    customers,
    selectedCustomerId,
    setSelectedCustomerId,
    description,
    setDescription,
    onConfirm,
    loading
}) => {
    if (!isOpen) return null;

    const filteredItems = items.filter(item => item.required_po_qty > 0);

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
        }}>
            <div style={{
                backgroundColor: '#fff',
                borderRadius: '8px',
                width: '100%',
                maxWidth: '600px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
                overflow: 'hidden',
                boxSizing: 'border-box'
            }}>
                {/* Header */}
                <div style={{
                    padding: '16px 24px',
                    borderBottom: '1px solid #dee2e6',
                    backgroundColor: '#f8f9fa'
                }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#212529' }}>
                        Confirm Create Draft PO
                    </h3>
                </div>

                {/* Content */}
                <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px', boxSizing: 'border-box' }}>

                    {/* Customer Selection */}
                    <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#212529' }}>
                            Select Customer:
                        </label>
                        <select
                            value={selectedCustomerId}
                            onChange={(e) => setSelectedCustomerId(e.target.value)}
                            disabled={loading}
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: '4px',
                                border: '1px solid #ced4da',
                                fontSize: '13px',
                                backgroundColor: loading ? '#e9ecef' : '#fff',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                boxSizing: 'border-box'
                            }}
                        >
                            {customers.map(c => (
                                <option key={c.customer_id} value={c.customer_id}>
                                    {c.company_name} ({c.customer_code})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Description Textarea */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <label style={{ fontSize: '13px', fontWeight: '600', color: '#212529' }}>
                                Description (Optional):
                            </label>
                            <span style={{ fontSize: '12px', color: '#6c757d' }}>
                                {description ? description.length : 0}/50
                            </span>
                        </div>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            maxLength={50}
                            disabled={loading}
                            placeholder="Enter short description (max 50 chars)"
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: '4px',
                                border: '1px solid #ced4da',
                                fontSize: '13px',
                                backgroundColor: loading ? '#e9ecef' : '#fff',
                                cursor: loading ? 'not-allowed' : 'text',
                                minHeight: '60px',
                                resize: 'vertical',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    {/* Product Summary */}
                    <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#212529' }}>
                            Processed Products Summary:
                        </label>
                        <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: '4px', boxSizing: 'border-box' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid #dee2e6' }}>
                                        <th style={{ padding: '8px 12px', textAlign: 'left', color: '#495057' }}>Product Code & Name</th>
                                        <th style={{ padding: '8px 12px', textAlign: 'right', color: '#495057' }}>Required Qty (Pcs)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredItems.map(item => (
                                        <tr key={item.id_product} style={{ borderBottom: '1px solid #e9ecef' }}>
                                            <td style={{ padding: '8px 12px', color: '#212529' }}>
                                                {item.product_code} - {item.product_name}
                                            </td>
                                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 'bold', color: '#212529' }}>
                                                {formatQty(item.required_po_qty)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div style={{ fontSize: '12px', color: '#6c757d', fontStyle: 'italic' }}>
                        * Unit price, subtotal, VAT, and total amount will be calculated automatically by the system upon saving.
                    </div>
                </div>

                {/* Footer Buttons */}
                <div style={{
                    padding: '12px 24px',
                    borderTop: '1px solid #dee2e6',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '8px',
                    backgroundColor: '#f8f9fa'
                }}>
                    <button
                        onClick={onClose}
                        disabled={loading}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#6c757d',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            opacity: loading ? 0.6 : 1,
                            fontSize: '13px',
                            fontWeight: '500',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={loading}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#0d6efd',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            fontWeight: '600',
                            fontSize: '13px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            opacity: loading ? 0.6 : 1,
                            pointerEvents: loading ? 'none' : 'auto',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        {loading ? 'Processing...' : 'Create Draft PO'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmCreatePOModal;
