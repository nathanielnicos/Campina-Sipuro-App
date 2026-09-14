const Actions = ({ poId, userRole, poStatus, loading, onClose, onCancel, onUpdateStatus }) => {
    // Helper untuk style tombol universal saat loading
    const getButtonStyle = (baseBgColor = 'transparent', isTextWhite = true) => ({
        padding: '8px 16px',
        backgroundColor: baseBgColor,
        color: isTextWhite ? '#fff' : '#000',
        border: baseBgColor === 'transparent' ? '1px solid #ccc' : 'none',
        borderRadius: '4px',
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.6 : 1,
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
                        disabled={loading}
                        style={getButtonStyle('#dc3545')}
                    >
                        {loading ? 'Cancelling...' : 'Cancel PO'}
                    </button>
                )}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
                <button
                    type="button"
                    onClick={onClose}
                    disabled={loading}
                    style={getButtonStyle('#6c757d')}
                >
                    Close
                </button>

                {/* Approve & Reject hanya muncul untuk non-CUSTOMER dan saat status "Waiting for Confirmation" */}
                {poId && userRole !== 'CUSTOMER' && poStatus === 'Waiting for Confirmation' && (
                    <>
                        <button
                            type="button"
                            disabled={loading}
                            onClick={() => onUpdateStatus('Rejected')}
                            style={getButtonStyle('#dc3545')}
                        >
                            {loading ? 'Rejecting...' : 'Reject PO'}
                        </button>
                        <button
                            type="button"
                            disabled={loading}
                            onClick={() => onUpdateStatus('Waiting for Batch Assignment')}
                            style={getButtonStyle('#198754')}
                        >
                            {loading ? 'Approving...' : 'Approve PO'}
                        </button>
                    </>
                )}

                {userRole === 'CUSTOMER' && (!poId || poStatus === 'Waiting for Confirmation') && (
                    <button
                        type="submit"
                        disabled={loading}
                        style={getButtonStyle('#0d6efd')}
                    >
                        {loading
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
