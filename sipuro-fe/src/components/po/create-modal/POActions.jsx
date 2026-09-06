const POActions = ({ poId, userRole, poStatus, loading, onClose, onCancel, onUpdateStatus }) => {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
            <div>
                {poId && userRole === 'CUSTOMER' && poStatus === 'Waiting for Confirmation' && (
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={loading}
                        style={{ padding: '8px 16px', backgroundColor: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        Batalkan PO
                    </button>
                )}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" onClick={onClose} style={{ padding: '8px 16px' }}>
                    Tutup
                </button>

                {/* Approve & Reject hanya muncul untuk non-CUSTOMER dan saat status "Waiting for Confirmation" */}
                {poId && userRole !== 'CUSTOMER' && poStatus === 'Waiting for Confirmation' && (
                    <>
                        <button
                            type="button"
                            disabled={loading}
                            onClick={() => onUpdateStatus('Rejected')}
                            style={{ padding: '8px 16px', backgroundColor: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        >
                            Reject PO
                        </button>
                        <button
                            type="button"
                            disabled={loading}
                            onClick={() => onUpdateStatus('Waiting for Batch Assignment')}
                            style={{ padding: '8px 16px', backgroundColor: '#198754', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        >
                            Approve PO
                        </button>
                    </>
                )}

                {userRole === 'CUSTOMER' && (!poId || poStatus === 'Waiting for Confirmation') && (
                    <button
                        type="submit"
                        disabled={loading}
                        style={{ padding: '8px 16px', backgroundColor: '#0d6efd', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        {poId ? 'Simpan Perubahan' : 'Simpan PO'}
                    </button>
                )}
            </div>
        </div>
    );
};

export default POActions;
