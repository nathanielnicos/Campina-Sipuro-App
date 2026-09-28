const BASE_BADGE_STYLE = {
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: '600',
    display: 'inline-block',
    whiteSpace: 'nowrap'
};

const STATUS_MAP = {
    // Status PO Header & General Statuses
    'Draft': { backgroundColor: '#f1f3f5', color: '#495057', border: '1px solid #ced4da' },
    'Waiting for Confirmation': { backgroundColor: '#fff3bf', color: '#f59f00', border: '1px solid #ffe066' },
    'Canceled': { backgroundColor: '#f8f9fa', color: '#868e96', border: '1px solid #dee2e6' },
    'Approved': { backgroundColor: '#e7f5ff', color: '#1971c2', border: '1px solid #a5d8ff' },
    'Rejected': { backgroundColor: '#ffe3e3', color: '#e03131', border: '1px solid #ffa8a8' },
    'Production Completed': { backgroundColor: '#e6fcf5', color: '#0ca678', border: '1px solid #96f2d7' },
    'Open': { backgroundColor: '#e7f5ff', color: '#1864ab', border: '1px solid #a5d8ff' },
    'Force Closed': { backgroundColor: '#ffe8cc', color: '#d9480f', border: '1px solid #ffd8a8' },

    // Status Detail / Item PO
    'Active': { backgroundColor: '#e7f5ff', color: '#1971c2', border: '1px solid #a5d8ff' },
    'Close Requested': { backgroundColor: '#fff9db', color: '#f59f00', border: '1px solid #ffe066' },
    'Closed': { backgroundColor: '#ebfbee', color: '#2b8a3e', border: '1px solid #b2f2bb' },
    'Partially Closed': { backgroundColor: '#f3d9fa', color: '#9c36b5', border: '1px solid #eebefa' }
};

export const getStatusStyle = (status) => {
    const style = STATUS_MAP[status] || { backgroundColor: '#f1f3f5', color: '#495057', border: '1px solid #dee2e6' };
    return {
        ...BASE_BADGE_STYLE,
        ...style
    };
};
