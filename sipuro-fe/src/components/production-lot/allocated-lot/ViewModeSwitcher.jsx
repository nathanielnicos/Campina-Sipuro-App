const ViewModeSwitcher = ({ viewMode, onViewModeChange }) => {
    const isPoMode = viewMode === 'PO' || viewMode === 'BY_PO';
    const isBatchMode = viewMode === 'BATCH' || viewMode === 'BY_BATCH';
    const isLotMode = viewMode === 'LOT' || viewMode === 'BY_LOT';

    const buttonStyle = (isActive) => ({
        padding: '6px 14px',
        border: 'none',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: 'bold',
        cursor: 'pointer',
        backgroundColor: isActive ? '#0d6efd' : 'transparent',
        color: isActive ? '#fff' : '#6c757d',
        transition: 'all 0.2s'
    });

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

            <div style={{ display: 'flex', backgroundColor: '#e9ecef', borderRadius: '6px', padding: '3px', gap: '2px' }}>
                <button
                    type="button"
                    onClick={() => onViewModeChange('PO')}
                    style={buttonStyle(isPoMode)}
                >
                    PO Number
                </button>

                <button
                    type="button"
                    onClick={() => onViewModeChange('BATCH')}
                    style={buttonStyle(isBatchMode)}
                >
                    Batch Number
                </button>
                <button
                    type="button"
                    onClick={() => onViewModeChange('LOT')}
                    style={buttonStyle(isLotMode)}
                >
                    Lot Number
                </button>
            </div>
        </div>
    );
};

export default ViewModeSwitcher;
