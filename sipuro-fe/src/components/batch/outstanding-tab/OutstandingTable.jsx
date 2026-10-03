import PaginationControl from '../../common/PaginationControl';
import SortableHeader from '../../common/SortableHeader';
import Filter from './Filter';
import TableRow from './TableRow';

// Hooks
import { useOutstandingTable } from '../../../hooks/batch/outstanding-tab/useOutstandingTable';

const OutstandingTable = ({ reloadTrigger, currentUser }) => {
    const {
        summaryList,
        loading,
        actionLoading,
        error,
        setError,
        successMessage,
        setSuccessMessage,
        searchProduct,
        searchPo,
        fromCreatedDate,
        toCreatedDate,
        statusFilter,
        sortKey,
        sortOrder,
        pagination,
        confirmModal,
        actionReason,
        reasonError,
        setActionReason,
        setPage,
        setLimit,
        handleProductChange,
        handlePoChange,
        handleFromCreatedDateChange,
        handleToCreatedDateChange,
        handleStatusFilterChange,
        handleResetFilters,
        handleSort,
        openConfirmModal,
        closeConfirmModal,
        handleConfirmSubmit
    } = useOutstandingTable(reloadTrigger, currentUser);

    const getModalTitle = () => {
        switch (confirmModal.type) {
            case 'REQUEST_CLOSE':
                return 'Request Close PO Item';
            case 'APPROVE_CLOSE':
                return 'Approve Close Request';
            case 'REJECT_CLOSE':
                return 'Reject Close Request';
            default:
                return 'Confirmation';
        }
    };

    const getSubmitButtonLabel = () => {
        if (!actionLoading) return 'Confirm';
        switch (confirmModal.type) {
            case 'REQUEST_CLOSE':
                return 'Submitting...';
            case 'APPROVE_CLOSE':
                return 'Approving...';
            case 'REJECT_CLOSE':
                return 'Rejecting...';
            default:
                return 'Processing...';
        }
    };

    return (
        <div style={{ position: 'relative', opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s' }}>
            {loading && (
                <div style={{
                    position: 'absolute',
                    top: -25,
                    right: 10,
                    fontSize: '12px',
                    color: '#0d6efd',
                    fontWeight: 'bold',
                    zIndex: 10
                }}>
                    Loading data...
                </div>
            )}

            <Filter
                searchProduct={searchProduct}
                searchPo={searchPo}
                fromCreatedDate={fromCreatedDate}
                toCreatedDate={toCreatedDate}
                statusFilter={statusFilter}
                onProductChange={handleProductChange}
                onPoChange={handlePoChange}
                onFromCreatedDateChange={handleFromCreatedDateChange}
                onToCreatedDateChange={handleToCreatedDateChange}
                onStatusFilterChange={handleStatusFilterChange}
                onResetFilters={handleResetFilters}
            />

            <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e9ecef', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', tableLayout: 'auto' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid #dee2e6' }}>
                                <SortableHeader
                                    label={<>Product<br />Code</>}
                                    sortKey="product_code"
                                    currentSortKey={sortKey}
                                    currentSortOrder={sortOrder}
                                    onSort={handleSort}
                                    style={{ width: '110px' }}
                                />
                                <SortableHeader
                                    label={<>Product<br />Name</>}
                                    sortKey="product_name"
                                    currentSortKey={sortKey}
                                    currentSortOrder={sortOrder}
                                    onSort={handleSort}
                                />
                                <SortableHeader
                                    label={<>Total Required<br />Qty (Pcs)</>}
                                    sortKey="total_required_qty"
                                    currentSortKey={sortKey}
                                    currentSortOrder={sortOrder}
                                    onSort={handleSort}
                                    align="right"
                                    style={{ width: '110px' }}
                                />
                                <SortableHeader
                                    label={<>Total Remaining<br />Qty (Pcs)</>}
                                    sortKey="total_remaining_qty"
                                    currentSortKey={sortKey}
                                    currentSortOrder={sortOrder}
                                    onSort={handleSort}
                                    align="right"
                                    style={{ width: '110px' }}
                                />
                                <SortableHeader
                                    label={<>PO<br />Count</>}
                                    sortKey="total_po_count"
                                    currentSortKey={sortKey}
                                    currentSortOrder={sortOrder}
                                    onSort={handleSort}
                                    align="center"
                                    style={{ width: '65px' }}
                                />
                                <th style={{ padding: '8px 10px', textAlign: 'left', color: '#495057', fontWeight: '600', width: '150px' }}>
                                    PO Number
                                </th>
                                <th style={{ padding: '8px 10px', textAlign: 'center', color: '#495057', fontWeight: '600', width: '100px' }}>
                                    PO Created<br />Date
                                </th>
                                <th style={{ padding: '8px 10px', textAlign: 'right', color: '#495057', fontWeight: '600', width: '110px' }}>
                                    PO Qty<br />(Pcs)
                                </th>
                                <th style={{ padding: '8px 10px', textAlign: 'right', color: '#495057', fontWeight: '600', width: '110px' }}>
                                    PO Remaining<br />Qty (Pcs)
                                </th>
                                <th style={{ padding: '8px 10px', textAlign: 'center', color: '#495057', fontWeight: '600', width: '110px' }}>
                                    Status
                                </th>
                                <th style={{ padding: '8px 10px', textAlign: 'center', color: '#495057', fontWeight: '600', width: '120px' }}>
                                    Action
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {summaryList.length === 0 ? (
                                <tr>
                                    <td colSpan="11" style={{ textAlign: 'center', padding: '32px', color: '#6c757d' }}>
                                        No SKUs need to be allocated at this time.
                                    </td>
                                </tr>
                            ) : (
                                summaryList.map((row) => (
                                    <TableRow
                                        key={row.id_product}
                                        row={row}
                                        currentUser={currentUser}
                                        onOpenConfirm={openConfirmModal}
                                    />
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <PaginationControl
                    pagination={pagination}
                    onPageChange={(newPage) => setPage(newPage)}
                    onLimitChange={(newLimit) => {
                        setLimit(newLimit);
                        setPage(1);
                    }}
                />
            </div>

            {/* Modal Konfirmasi */}
            {confirmModal.isOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        backgroundColor: '#fff',
                        borderRadius: '8px',
                        padding: '20px',
                        width: '420px',
                        maxWidth: '90%',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                    }}>
                        <h4 style={{ marginTop: 0, marginBottom: '12px', fontSize: '16px', fontWeight: 'bold' }}>
                            {getModalTitle()}
                        </h4>

                        <div style={{ fontSize: '13px', color: '#495057', marginBottom: '16px' }}>
                            <p style={{ margin: '0 0 6px 0' }}>
                                <strong>PO Number:</strong> {confirmModal.poNumber}
                            </p>
                            <p style={{ margin: 0 }}>
                                <strong>Product:</strong> {confirmModal.productName}
                            </p>
                        </div>

                        {confirmModal.type === 'REQUEST_CLOSE' && (
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 'bold' }}>
                                    Reason for Request <span style={{ color: '#dc3545' }}>*</span>
                                </label>
                                <textarea
                                    value={actionReason}
                                    onChange={(e) => setActionReason(e.target.value)}
                                    disabled={actionLoading}
                                    placeholder="Enter your reason here..."
                                    maxLength={50}
                                    rows={3}
                                    style={{
                                        width: '100%',
                                        padding: '8px',
                                        borderRadius: '4px',
                                        border: '1px solid #ced4da',
                                        boxSizing: 'border-box',
                                        fontSize: '13px',
                                        resize: 'vertical'
                                    }}
                                />
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                                    {reasonError ? (
                                        <span style={{ color: '#dc3545', fontSize: '11px' }}>{reasonError}</span>
                                    ) : <span />}
                                    <span style={{ color: '#6c757d', fontSize: '11px' }}>
                                        {actionReason.length}/50
                                    </span>
                                </div>
                            </div>
                        )}

                        {confirmModal.type === 'APPROVE_CLOSE' && (
                            <p style={{ fontSize: '13px', color: '#212529', marginBottom: '20px' }}>
                                Are you sure you want to <strong>approve</strong> this close request?
                            </p>
                        )}

                        {confirmModal.type === 'REJECT_CLOSE' && (
                            <p style={{ fontSize: '13px', color: '#212529', marginBottom: '20px' }}>
                                Are you sure you want to <strong>reject</strong> this close request?
                            </p>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button
                                onClick={closeConfirmModal}
                                disabled={actionLoading}
                                style={{
                                    padding: '8px 14px',
                                    backgroundColor: '#6c757d',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                                    fontSize: '12px',
                                    fontWeight: 'bold',
                                    opacity: actionLoading ? 0.65 : 1
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmSubmit}
                                disabled={actionLoading}
                                style={{
                                    padding: '8px 14px',
                                    backgroundColor: confirmModal.type === 'REJECT_CLOSE' ? '#dc3545' : confirmModal.type === 'APPROVE_CLOSE' ? '#198754' : '#0d6efd',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                                    fontSize: '12px',
                                    fontWeight: 'bold',
                                    opacity: actionLoading ? 0.65 : 1,
                                    transition: 'all 0.2s ease-in-out'
                                }}
                            >
                                {getSubmitButtonLabel()}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Notifikasi Sukses */}
            {successMessage && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100
                }}>
                    <div style={{
                        backgroundColor: '#fff', padding: '24px', borderRadius: '8px', width: '380px', maxWidth: '90vw',
                        textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                    }}>
                        <div style={{ fontSize: '36px', color: '#198754', marginBottom: '8px' }}>✓</div>
                        <h4 style={{ marginTop: 0, marginBottom: '8px', color: '#198754' }}>Success</h4>
                        <p style={{ fontSize: '13px', color: '#495057', marginBottom: '20px' }}>{successMessage}</p>
                        <button
                            type="button"
                            onClick={() => setSuccessMessage('')}
                            style={{
                                padding: '8px 20px',
                                backgroundColor: '#198754',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 'bold'
                            }}
                        >
                            OK
                        </button>
                    </div>
                </div>
            )}

            {/* Modal Notifikasi Eror */}
            {error && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100
                }}>
                    <div style={{
                        backgroundColor: '#fff', padding: '24px', borderRadius: '8px', width: '380px', maxWidth: '90vw',
                        textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                    }}>
                        <div style={{ fontSize: '36px', color: '#dc3545', marginBottom: '8px' }}>⚠️</div>
                        <h4 style={{ marginTop: 0, marginBottom: '8px', color: '#dc3545' }}>Error</h4>
                        <p style={{ fontSize: '13px', color: '#495057', marginBottom: '20px' }}>{error}</p>
                        <button
                            type="button"
                            onClick={() => setError('')}
                            style={{
                                padding: '8px 20px',
                                backgroundColor: '#dc3545',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 'bold'
                            }}
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OutstandingTable;
