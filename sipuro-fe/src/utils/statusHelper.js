const STATUS_MAP = {
    'Draft': { backgroundColor: '#cce5ff', color: '#004085' },
    'Waiting for Confirmation': { backgroundColor: '#fff3cd', color: '#856404' },
    'Canceled': { backgroundColor: '#e2e3e5', color: '#383d41' },
    'Approved': { backgroundColor: '#d1ecf1', color: '#0c5460' },
    'Rejected': { backgroundColor: '#f8d7da', color: '#721c24' },
    'Production Completed': { backgroundColor: '#d4edda', color: '#155724' },
    'Open': { backgroundColor: '#fff3cd', color: '#664d03' },
    'Closed': { backgroundColor: '#d1e7dd', color: '#0f5132' },
    'Force Closed': { backgroundColor: '#f8d7da', color: '#842029' }
};

export const getStatusStyle = (status) =>
    STATUS_MAP[status] || { backgroundColor: '#e2e3e5', color: '#383d41' };
