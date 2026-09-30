export const AllocationActionButton = ({
    status,
    allocationId,
    currentUserRole,
    onForceClose,
    loading
}) => {
    if (currentUserRole === 'CUSTOMER' || status !== 'Open' || !allocationId) return '-';

    return (
        <button
            type="button"
            onClick={() => onForceClose(allocationId)}
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
