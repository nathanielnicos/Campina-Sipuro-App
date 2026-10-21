import { useState } from 'react';
import { MAX_REASON_LENGTH, validateReason } from '../../utils/outstandingPoHelpers';

const TITLES = {
    REQUEST_CLOSE: 'Request Close PO Item',
    APPROVE_CLOSE: 'Approve Close Request',
    REJECT_CLOSE: 'Reject Close Request'
};

const SUBMIT_LABELS = {
    REQUEST_CLOSE: 'Submitting...',
    APPROVE_CLOSE: 'Approving...',
    REJECT_CLOSE: 'Rejecting...'
};

const CONFIRM_COLORS = {
    REQUEST_CLOSE: '#0d6efd',
    APPROVE_CLOSE: '#198754',
    REJECT_CLOSE: '#dc3545'
};

/** Dialog konfirmasi close item PO. Alasan hanya diisi customer saat mengajukan. */
const CloseDialog = ({ action, product, item, submitting, onConfirm, onCancel }) => {
    const [reason, setReason] = useState('');
    const [reasonError, setReasonError] = useState('');

    const handleConfirm = () => {
        if (action !== 'REQUEST_CLOSE') {
            onConfirm('');
            return;
        }
        const result = validateReason(reason);
        if (!result.ok) {
            setReasonError(result.message);
            return;
        }
        onConfirm(result.value);
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
            <div style={{
                backgroundColor: '#fff', borderRadius: '8px', padding: '20px', width: '420px', maxWidth: '90%',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            }}>
                <h4 style={{ marginTop: 0, marginBottom: '12px', fontSize: '16px', fontWeight: 'bold' }}>
                    {TITLES[action] || 'Confirmation'}
                </h4>

                <div style={{ fontSize: '13px', color: '#495057', marginBottom: '16px' }}>
                    <p style={{ margin: '0 0 6px 0' }}><strong>PO Number:</strong> {item.po_number}</p>
                    <p style={{ margin: 0 }}><strong>Product:</strong> {product.product_name}</p>
                    {action !== 'REQUEST_CLOSE' && (
                        <p style={{ margin: '6px 0 0 0' }}><strong>Customer Reason:</strong> {item.close_reason || '-'}</p>
                    )}
                </div>

                {action === 'REQUEST_CLOSE' && (
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 'bold' }}>
                            Reason for Request <span style={{ color: '#dc3545' }}>*</span>
                        </label>
                        <textarea
                            value={reason}
                            onChange={(e) => { setReason(e.target.value); setReasonError(''); }}
                            disabled={submitting}
                            placeholder="Enter your reason here..."
                            maxLength={MAX_REASON_LENGTH}
                            rows={3}
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da', boxSizing: 'border-box', fontSize: '13px', resize: 'vertical' }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                            {reasonError ? <span style={{ color: '#dc3545', fontSize: '11px' }}>{reasonError}</span> : <span />}
                            <span style={{ color: '#6c757d', fontSize: '11px' }}>{reason.length}/{MAX_REASON_LENGTH}</span>
                        </div>
                    </div>
                )}

                {action === 'APPROVE_CLOSE' && (
                    <p style={{ fontSize: '13px', color: '#212529', marginBottom: '20px' }}>
                        Are you sure you want to <strong>approve</strong> this close request?
                        {' '}{item.produced_qty > 0 ? 'The item already has production, so it becomes Partially Closed.' : 'The item has no production yet, so it becomes Closed.'}
                    </p>
                )}

                {action === 'REJECT_CLOSE' && (
                    <p style={{ fontSize: '13px', color: '#212529', marginBottom: '20px' }}>
                        Are you sure you want to <strong>reject</strong> this close request?
                    </p>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={submitting}
                        style={{ padding: '8px 14px', backgroundColor: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', cursor: submitting ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', opacity: submitting ? 0.65 : 1 }}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={submitting}
                        style={{ padding: '8px 14px', backgroundColor: CONFIRM_COLORS[action] || '#0d6efd', color: '#fff', border: 'none', borderRadius: '4px', cursor: submitting ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', opacity: submitting ? 0.65 : 1 }}
                    >
                        {submitting ? (SUBMIT_LABELS[action] || 'Processing...') : 'Confirm'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CloseDialog;
