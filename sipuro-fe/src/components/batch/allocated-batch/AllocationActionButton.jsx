export const AllocationActionButton = ({
    status,
    allocationId,
    currentUserRole,
    onForceClose,
    loading
}) => {
    // Sembunyikan hanya jika role adalah CUSTOMER
    if (currentUserRole === 'CUSTOMER') return null;

    const isOpen = status === 'Open' && Boolean(allocationId);
    const isDisabled = !isOpen || loading;

    return (
        <button
            type="button"
            onClick={() => isOpen && onForceClose && onForceClose(allocationId)}
            disabled={isDisabled}
            title={isOpen ? 'Force Close Allocation' : `Allocation status is ${status || 'Closed'}`}
            style={{
                padding: '4px 8px',
                backgroundColor: isDisabled ? '#ced4da' : '#fd7e14',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.65 : isDisabled ? 0.75 : 1
            }}
        >
            {loading ? 'Processing...' : 'Force Close'}
        </button>
    );
};

export default AllocationActionButton;
