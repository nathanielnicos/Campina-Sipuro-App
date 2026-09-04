const STATUS_MAP = {
    'Waiting for Confirmation': { backgroundColor: '#fff3cd', color: '#856404' },
    'Waiting for Batch Assignment': { backgroundColor: '#d1ecf1', color: '#0c5460' },
    'In Progress': { backgroundColor: '#cce5ff', color: '#004085' },
    'Completed': { backgroundColor: '#d4edda', color: '#155724' },
    'Rejected': { backgroundColor: '#f8d7da', color: '#721c24' },
    'Canceled': { backgroundColor: '#e2e3e5', color: '#383d41' },
    'Open': { backgroundColor: '#fff3cd', color: '#664d03' },
    'Closed': { backgroundColor: '#d1e7dd', color: '#0f5132' }
};

export const getStatusStyle = (status) =>
    STATUS_MAP[status] || { backgroundColor: '#e2e3e5', color: '#383d41' };
