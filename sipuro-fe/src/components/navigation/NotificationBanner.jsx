const NotificationBanner = ({ show, message, onRefresh }) => {
    if (!show) return null;

    return (
        <div style={{
            backgroundColor: '#e7f5ff',
            border: '1px solid #74c0fc',
            borderRadius: '6px',
            padding: '10px 16px',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '13px',
            color: '#1864ab'
        }}>
            <span>💡 {message || 'There is a new PO update available.'}</span>
            <button
                type="button"
                onClick={onRefresh}
                style={{
                    backgroundColor: '#1c7ed6',
                    color: '#fff',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontSize: '12px'
                }}
            >
                Show Latest Data
            </button>
        </div>
    );
};

export default NotificationBanner;
