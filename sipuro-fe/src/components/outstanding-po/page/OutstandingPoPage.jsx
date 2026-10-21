import { useState } from 'react';
import { useOutstandingPo } from '../../../hooks/outstanding-po/useOutstandingPo';
import { requestCloseItem, approveCloseItem, rejectCloseItem } from '../../../services/outstandingPoApi';
import { getRoleFlags } from '../../../utils/outstandingPoHelpers';
import OutstandingPoFilter from '../OutstandingPoFilter';
import OutstandingPoTable from '../OutstandingPoTable';
import CloseDialog from '../CloseDialog';

const MESSAGE_OVERLAY = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100
};
const MESSAGE_BOX = {
    backgroundColor: '#fff', padding: '24px', borderRadius: '8px', width: '380px', maxWidth: '90vw',
    textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
};

const MessageModal = ({ success, message, onClose }) => {
    const color = success ? '#198754' : '#dc3545';
    return (
        <div style={MESSAGE_OVERLAY}>
            <div style={MESSAGE_BOX}>
                <div style={{ fontSize: '36px', color, marginBottom: '8px' }}>{success ? '✓' : '⚠️'}</div>
                <h4 style={{ marginTop: 0, marginBottom: '8px', color }}>{success ? 'Success' : 'Error'}</h4>
                <p style={{ fontSize: '13px', color: '#495057', marginBottom: '20px' }}>{message}</p>
                <button
                    type="button"
                    onClick={onClose}
                    style={{ padding: '8px 20px', backgroundColor: color, color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                >
                    {success ? 'OK' : 'Close'}
                </button>
            </div>
        </div>
    );
};

const OutstandingPoPage = ({ currentUser }) => {
    const roleFlags = getRoleFlags(currentUser);
    const {
        filters, updateFilter, resetFilters,
        setPage, changeLimit, sortKey, sortOrder, handleSort,
        rows, pagination, loading, error, setError, reload
    } = useOutstandingPo();

    const [dialog, setDialog] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    const handleConfirm = async (reason) => {
        if (!dialog || submitting) return;
        setSubmitting(true);
        const id = dialog.item.po_detail_id;
        let response;
        if (dialog.action === 'REQUEST_CLOSE') response = await requestCloseItem(id, reason);
        else if (dialog.action === 'APPROVE_CLOSE') response = await approveCloseItem(id);
        else response = await rejectCloseItem(id);
        setSubmitting(false);
        setDialog(null);

        if (response.success) {
            setSuccessMessage(response.message || 'Done.');
        } else {
            setError(response.message || 'Request failed.');
        }
        reload();
    };

    return (
        <div style={{ padding: '0px 20px 20px 20px', fontFamily: 'sans-serif' }}>
            <div style={{ position: 'relative', opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s' }}>
                {loading && (
                    <div style={{ position: 'absolute', top: -25, right: 10, fontSize: '12px', color: '#0d6efd', fontWeight: 'bold', zIndex: 10 }}>
                        Loading data...
                    </div>
                )}

                <OutstandingPoFilter filters={filters} onChange={updateFilter} onReset={resetFilters} />

                <OutstandingPoTable
                    rows={rows}
                    sortKey={sortKey}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                    pagination={pagination}
                    onPageChange={setPage}
                    onLimitChange={changeLimit}
                    roleFlags={roleFlags}
                    onAction={(action, product, item) => setDialog({ action, product, item })}
                />
            </div>

            {dialog && (
                <CloseDialog
                    key={`${dialog.action}-${dialog.item.po_detail_id}`}
                    action={dialog.action}
                    product={dialog.product}
                    item={dialog.item}
                    submitting={submitting}
                    onConfirm={handleConfirm}
                    onCancel={() => setDialog(null)}
                />
            )}

            {successMessage && <MessageModal success message={successMessage} onClose={() => setSuccessMessage('')} />}
            {error && <MessageModal success={false} message={error} onClose={() => setError('')} />}
        </div>
    );
};

export default OutstandingPoPage;
