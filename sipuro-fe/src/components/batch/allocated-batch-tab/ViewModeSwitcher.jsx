const ViewModeSwitcher = ({ viewMode, onViewModeChange, currentUserRole }) => {
    const isBatchMode = viewMode === 'BATCH' || viewMode === 'BY_BATCH';
    const isPoMode = viewMode === 'PO' || viewMode === 'BY_PO';

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: '1px solid #dee2e6',
            backgroundColor: '#f8f9fa'
        }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#495057' }}>
                Display Data By:
            </span>

            <div style={{ display: 'flex', backgroundColor: '#e9ecef', borderRadius: '6px', padding: '3px' }}>
                {currentUserRole !== 'CUSTOMER' && (
                    <button
                        type="button"
                        onClick={() => onViewModeChange('BATCH')}
                        style={{
                            padding: '6px 14px',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            backgroundColor: isBatchMode ? '#0d6efd' : 'transparent',
                            color: isBatchMode ? '#fff' : '#6c757d',
                            transition: 'all 0.2s'
                        }}
                    >
                        Batch Number
                    </button>
                )}
                <button
                    type="button"
                    onClick={() => onViewModeChange('PO')}
                    style={{
                        padding: '6px 14px',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        backgroundColor: isPoMode ? '#0d6efd' : 'transparent',
                        color: isPoMode ? '#fff' : '#6c757d',
                        transition: 'all 0.2s'
                    }}
                >
                    PO Number
                </button>
            </div>
        </div>
    );
};

export default ViewModeSwitcher;
