const Actions = ({ poId, userRole, poStatus, loading, onClose, onCancel, onUpdateStatus }) => {
    const isAnyLoading = Boolean(loading);

    const getButtonStyle = (baseBgColor = 'transparent', isTextWhite = true) => ({
        padding: '8px 16px',
        backgroundColor: baseBgColor,
        color: isTextWhite ? '#fff' : '#000',
        border: baseBgColor === 'transparent' ? '1px solid #ccc' : 'none',
        borderRadius: '4px',
        cursor: isAnyLoading ? 'not-allowed' : 'pointer',
        opacity: isAnyLoading ? 0.6 : 1,
        fontWeight: baseBgColor !== 'transparent' ? 'bold' : 'normal',
        transition: 'all 0.2s ease-in-out'
    });

    const isCustomer = userRole === 'CUSTOMER';
    const isDraftOrNew = !poId || poStatus === 'Draft';
    const isWaiting = poStatus === 'Waiting for Confirmation';

    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '32px' }}>
            <div>
                {/* Tombol Cancel PO aktif saat Waiting for Confirmation ATAU Draft */}
                {poId && isCustomer && (isWaiting || poStatus === 'Draft') && (
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={isAnyLoading}
                        style={getButtonStyle('#dc3545')}
                    >
                        {loading === 'CANCEL' ? 'Cancelling...' : 'Cancel PO'}
                    </button>
                )}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
                <button
                    type="button"
                    onClick={onClose}
                    disabled={isAnyLoading}
                    style={getButtonStyle('#6c757d')}
                >
                    Close
                </button>

                {/* Approve & Reject untuk non-CUSTOMER saat Waiting for Confirmation */}
                {poId && !isCustomer && isWaiting && (
                    <>
                        <button
                            type="button"
                            disabled={isAnyLoading}
                            onClick={() => onUpdateStatus('Rejected')}
                            style={getButtonStyle('#dc3545')}
                        >
                            {loading === 'REJECT' ? 'Rejecting...' : 'Reject PO'}
                        </button>
                        <button
                            type="button"
                            disabled={isAnyLoading}
                            onClick={() => onUpdateStatus('Approved')}
                            style={getButtonStyle('#198754')}
                        >
                            {loading === 'APPROVE' ? 'Approving...' : 'Approve PO'}
                        </button>
                    </>
                )}

                {/* Tombol khusus CUSTOMER saat pembuatan baru/Draft */}
                {isCustomer && isDraftOrNew && (
                    <>
                        {/* Tombol Save as Draft */}
                        <button
                            type="submit"
                            name="target_status"
                            value="Draft"
                            disabled={isAnyLoading}
                            style={getButtonStyle('#6f42c1')}
                        >
                            {loading === 'SAVE_DRAFT' ? 'Saving Draft...' : 'Save as Draft'}
                        </button>

                        {/* Tombol Submit PO (Mengubah status menjadi Waiting for Confirmation) */}
                        <button
                            type="submit"
                            name="target_status"
                            value="Waiting for Confirmation"
                            disabled={isAnyLoading}
                            style={getButtonStyle('#0d6efd')}
                        >
                            {loading === 'SUBMIT' ? 'Submitting...' : 'Submit PO'}
                        </button>
                    </>
                )}

                {/* Tombol Save Changes untuk Customer jika PO sudah posisi Waiting for Confirmation */}
                {isCustomer && poId && isWaiting && (
                    <button
                        type="submit"
                        disabled={isAnyLoading}
                        style={getButtonStyle('#0d6efd')}
                    >
                        {loading === 'SAVE' ? 'Saving...' : 'Save Changes'}
                    </button>
                )}
            </div>
        </div>
    );
};

export default Actions;
