import { useState, useEffect } from 'react';
import { formatThousand, unformatThousand } from '../../../utils/formatters';

export const EditQtyModal = ({ isOpen, onClose, allocationData, onSubmit, loading }) => {
    const [displayQty, setDisplayQty] = useState('');
    const [reason, setReason] = useState('');

    useEffect(() => {
        if (allocationData) {
            setDisplayQty(formatThousand(allocationData.allocated_qty));
            setReason('');
        }
    }, [allocationData]);

    // Listener tombol Escape untuk menutup modal
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen && !loading) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, loading, onClose]);

    if (!isOpen || !allocationData) return null;

    const handleQtyChange = (e) => {
        const formatted = formatThousand(e.target.value);
        setDisplayQty(formatted);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const rawNumericStr = unformatThousand(displayQty);
        const parsedQty = Number(rawNumericStr);

        const allocId = allocationData.allocation_id || allocationData.id;

        if (!allocId || isNaN(parsedQty) || parsedQty < 0 || rawNumericStr === '') return;

        onSubmit(allocId, parsedQty, reason);
    };

    const rawNumeric = Number(unformatThousand(displayQty));
    const isValid = displayQty.trim() !== '' && !isNaN(rawNumeric) && rawNumeric >= 0;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
        }}>
            <div style={{
                backgroundColor: '#fff',
                borderRadius: '8px',
                width: '100%',
                maxWidth: '450px',
                padding: '24px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            }}>
                <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px', color: '#212529' }}>
                    Edit Allocated Quantity
                </h3>

                <form onSubmit={handleSubmit}>
                    {/* Info PO Number */}
                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ fontSize: '12px', color: '#6c757d', display: 'block', marginBottom: '4px' }}>
                            PO Number
                        </label>
                        <input
                            type="text"
                            value={allocationData.po_number || '-'}
                            disabled
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                border: '1px solid #ced4da',
                                borderRadius: '4px',
                                backgroundColor: '#e9ecef',
                                fontSize: '14px',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    {/* New Allocated Qty */}
                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ fontSize: '12px', color: '#212529', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
                            New Allocated Qty (Pcs) <span style={{ color: '#dc3545' }}>*</span>
                        </label>
                        <input
                            type="text"
                            value={displayQty}
                            onChange={handleQtyChange}
                            placeholder="Enter new quantity (e.g. 1.000)"
                            required
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                border: '1px solid #ced4da',
                                borderRadius: '4px',
                                fontSize: '14px',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    {/* Reason for Change */}
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ fontSize: '12px', color: '#6c757d', display: 'block', marginBottom: '4px' }}>
                            Reason for Change (Optional)
                        </label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Reason for editing quantity..."
                            rows="3"
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                border: '1px solid #ced4da',
                                borderRadius: '4px',
                                fontSize: '14px',
                                boxSizing: 'border-box',
                                resize: 'vertical'
                            }}
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            style={{
                                padding: '8px 16px',
                                border: '1px solid #6c757d',
                                backgroundColor: '#fff',
                                color: '#6c757d',
                                borderRadius: '4px',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                fontWeight: 'bold',
                                opacity: loading ? 0.65 : 1
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !isValid}
                            style={{
                                padding: '8px 16px',
                                border: 'none',
                                backgroundColor: loading || !isValid ? '#6c757d' : '#0d6efd',
                                color: '#fff',
                                borderRadius: '4px',
                                cursor: loading || !isValid ? 'not-allowed' : 'pointer',
                                fontWeight: 'bold',
                                opacity: loading || !isValid ? 0.65 : 1
                            }}
                        >
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditQtyModal;
