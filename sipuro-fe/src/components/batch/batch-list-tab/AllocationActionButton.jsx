export const AllocationActionButton = ({
    status,
    allocationId,
    fulfilledQty,
    currentUserRole,
    onUpdateStatus,
    loading
}) => {
    if (currentUserRole === 'CUSTOMER' || status !== 'Open' || !allocationId) return '-';

    const fulfilled = Number(fulfilledQty) || 0;

    if (fulfilled === 0) {
        return (
            <button
                type="button"
                onClick={() => onUpdateStatus(allocationId, 'CANCEL')}
                disabled={loading}
                style={{
                    padding: '4px 8px',
                    backgroundColor: loading ? '#6c757d' : '#dc3545',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.65 : 1
                }}
            >
                {loading ? 'Processing...' : 'Cancel'}
            </button>
        );
    }

    return (
        <button
            type="button"
            onClick={() => onUpdateStatus(allocationId, 'FORCE_CLOSE')}
            disabled={loading}
            style={{
                padding: '4px 8px',
                backgroundColor: loading ? '#6c757d' : '#fd7e14',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.65 : 1
            }}
        >
            {loading ? 'Processing...' : 'Force Close'}
        </button>
    );
};

export default AllocationActionButton;
