import { useState, useEffect } from 'react';
import { formatQty, formatThousand } from '../../../utils/formatters';
import { REASON_MAX_LENGTH, evaluateQtyForm } from '../../../hooks/production-lot/allocated-lot/allocationQtyRules';

const infoRow = (label, value) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '13px', padding: '2px 0' }}>
        <span style={{ color: '#6c757d' }}>{label}</span>
        <strong style={{ textAlign: 'right', wordBreak: 'break-word' }}>{value}</strong>
    </div>
);

export const EditAllocationQtyModal = ({ isOpen, onClose, allocation, onSubmit, loading }) => {
    const [qtyText, setQtyText] = useState('');
    const [reason, setReason] = useState('');

    useEffect(() => {
        if (allocation) {
            setQtyText(formatThousand(allocation.allocated_qty));
            setReason('');
        }
    }, [allocation]);

    // Tombol Escape menutup modal (kecuali sedang menyimpan)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen && !loading) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, loading, onClose]);

    if (!isOpen || !allocation) return null;

    const currentQty = Number(allocation.allocated_qty) || 0;
    const form = evaluateQtyForm({ qtyText, reasonText: reason, currentQty });
    const canSubmit = form.canSubmit && !loading;
    const isCross = allocation.po_product_code && allocation.product_code && allocation.po_product_code !== allocation.product_code;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!canSubmit) return;
        onSubmit(allocation.allocation_id, form.newQty, form.reason);
    };

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
                maxWidth: '460px',
                padding: '24px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            }}>
                <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px', color: '#212529' }}>
                    Edit Allocated Quantity
                </h3>

                <div style={{ backgroundColor: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: '6px', padding: '10px 12px', marginBottom: '16px' }}>
                    {infoRow('PO Number', allocation.po_number || '-')}
                    {infoRow('Lot Number', allocation.lot_number || '-')}
                    {infoRow('Batch Number', allocation.batch_number || '-')}
                    {infoRow('Produced Product', allocation.product_code || '-')}
                    {isCross && infoRow('PO Product (via mapping)', allocation.po_product_code)}
                    {infoRow('Current Allocated Qty', `${formatQty(currentQty)} pcs`)}
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ fontSize: '12px', color: '#212529', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
                            New Allocated Qty (Pcs) <span style={{ color: '#dc3545' }}>*</span>
                        </label>
                        <input
                            type="text"
                            inputMode="numeric"
                            value={qtyText}
                            onChange={(e) => setQtyText(formatThousand(e.target.value))}
                            placeholder="Enter new quantity (e.g. 1.000)"
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                border: '1px solid #ced4da',
                                borderRadius: '4px',
                                fontSize: '14px',
                                boxSizing: 'border-box'
                            }}
                        />
                        {form.isUnchanged && (
                            <div style={{ color: '#6c757d', fontSize: '11px', marginTop: '4px' }}>
                                The quantity is the same as the current allocation.
                            </div>
                        )}
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ fontSize: '12px', color: '#212529', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
                            Reason for Change <span style={{ color: '#dc3545' }}>*</span>
                        </label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            maxLength={REASON_MAX_LENGTH}
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
                        <div style={{ textAlign: 'right', color: '#6c757d', fontSize: '11px', marginTop: '2px' }}>
                            {reason.length}/{REASON_MAX_LENGTH}
                        </div>
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
                            disabled={!canSubmit}
                            style={{
                                padding: '8px 16px',
                                border: 'none',
                                backgroundColor: canSubmit ? '#0d6efd' : '#6c757d',
                                color: '#fff',
                                borderRadius: '4px',
                                cursor: canSubmit ? 'pointer' : 'not-allowed',
                                fontWeight: 'bold',
                                opacity: canSubmit ? 1 : 0.65
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

export default EditAllocationQtyModal;
