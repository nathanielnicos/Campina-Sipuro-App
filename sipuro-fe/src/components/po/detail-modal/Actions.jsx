const Actions = ({ poId, userRole, poStatus, loading, onClose, onCancel, onUpdateStatus }) => {
    // Helper untuk style tombol universal saat loading
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

    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
            <div>
                {poId && userRole === 'CUSTOMER' && poStatus === 'Waiting for Confirmation' && (
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

                {/* Approve & Reject hanya muncul untuk non-CUSTOMER dan saat status "Waiting for Confirmation" */}
                {poId && userRole !== 'CUSTOMER' && poStatus === 'Waiting for Confirmation' && (
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
                            onClick={() => onUpdateStatus('Waiting for Batch Assignment')}
                            style={getButtonStyle('#198754')}
                        >
                            {loading === 'APPROVE' ? 'Approving...' : 'Approve PO'}
                        </button>
                    </>
                )}

                {userRole === 'CUSTOMER' && (!poId || poStatus === 'Waiting for Confirmation') && (
                    <button
                        type="submit"
                        disabled={isAnyLoading}
                        style={getButtonStyle('#0d6efd')}
                    >
                        {loading === 'SAVE'
                            ? 'Saving...'
                            : (poId ? 'Save Changes' : 'Save PO')
                        }
                    </button>
                )}
            </div>
        </div>
    );
};

export default Actions;
