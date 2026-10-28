// Status alokasi yang boleh diubah qty-nya (Force Closed dan Canceled tidak). Force Close hanya untuk yang masih Open.
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

const AllocationActions = ({ allocation, busy = false, onEditQty, onHistory, onForceClose }) => {
    if (!allocation || !allocation.allocation_id) {
        return <span style={{ color: '#adb5bd' }}>-</span>;
    }

    const canEdit = !busy && EDITABLE_STATUSES.includes(allocation.status);
    const canForceClose = !busy && allocation.status === 'Open';
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

            <button
                type="button"
                disabled={!canForceClose}
                onClick={() => canForceClose && onForceClose(allocation)}
                title={canForceClose ? 'Force Close Allocation' : disabledTitle}
                style={{
                    padding: '4px 8px',
                    backgroundColor: canForceClose ? '#fd7e14' : '#ced4da',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: canForceClose ? 'pointer' : 'not-allowed',
                    opacity: canForceClose ? 1 : 0.75
                }}
            >
                {busy ? 'Processing...' : 'Force Close'}
            </button>
        </div>
    );
};

export default AllocationActions;
