// Status alokasi yang boleh diubah qty-nya (Force Closed dan Canceled tidak).
const EDITABLE_STATUSES = ['Open', 'Closed'];

const buttonStyle = (enabled, extra = {}) => ({
    border: '1px solid #ced4da',
    borderRadius: '4px',
    cursor: enabled ? 'pointer' : 'not-allowed',
    fontSize: '13px',
    padding: '3px 7px',
    backgroundColor: enabled ? '#fff' : '#e9ecef',
    color: enabled ? '#495057' : '#adb5bd',
    opacity: enabled ? 1 : 0.7,
    ...extra
});

const AllocationActions = ({ allocation, busy = false, onEditQty, onHistory }) => {
    if (!allocation || !allocation.allocation_id) {
        return <span style={{ color: '#adb5bd' }}>-</span>;
    }

    const canEdit = !busy && EDITABLE_STATUSES.includes(allocation.status);
    const disabledTitle = busy ? 'Processing...' : `Allocation status is ${allocation.status}`;

    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
            <button
                type="button"
                onClick={() => onHistory(allocation)}
                title="View Allocation History Log"
                style={buttonStyle(true)}
            >
                📜
            </button>

            <button
                type="button"
                disabled={!canEdit}
                onClick={() => canEdit && onEditQty(allocation)}
                title={canEdit ? 'Edit Allocated Quantity' : disabledTitle}
                style={buttonStyle(canEdit, { color: canEdit ? '#0d6efd' : '#adb5bd' })}
            >
                ✏️
            </button>
        </div>
    );
};

export default AllocationActions;
