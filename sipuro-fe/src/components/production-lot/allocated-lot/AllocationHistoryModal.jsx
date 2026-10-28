import { useEffect } from 'react';
import PaginationControl from '../../common/PaginationControl';
import { formatQty } from '../../../utils/formatters';
import { formatDateTime } from '../../../utils/dateHelper';

// Jenis perubahan dibaca dari isi log (kolom action_type di server hanya INSERT atau UPDATE)
const getActionInfo = (log) => {
    if (log.action_type === 'INSERT') {
        return { label: 'CREATED', backgroundColor: '#d1e7dd', color: '#0f5132' };
    }
    if (log.new_status === 'Force Closed' && log.old_status !== 'Force Closed') {
        return { label: 'FORCE CLOSE', backgroundColor: '#ffe8cc', color: '#d9480f' };
    }
    if (Number(log.old_allocated_qty) !== Number(log.new_allocated_qty)) {
        return { label: 'QTY CHANGE', backgroundColor: '#cff4fc', color: '#055160' };
    }
    return { label: 'STATUS CHANGE', backgroundColor: '#e2e3e5', color: '#41464b' };
};

export const AllocationHistoryModal = ({
    isOpen,
    onClose,
    allocation,
    logs = [],
    loading = false,
    error = '',
    pagination,
    onPageChange,
    onLimitChange
}) => {
    // Listener tombol Escape
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const batchNumber = allocation?.batch_number || '-';
    const lotNumber = allocation?.lot_number || '-';
    const poNumber = allocation?.po_number || '-';
    const productCode = allocation?.product_code || '-';
    const productName = allocation?.product_name || '';
    const poProductCode = allocation?.po_product_code;
    const isCross = Boolean(poProductCode) && poProductCode !== allocation?.product_code;

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, width: '100vw', height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1050,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
        }}>
            <div style={{
                backgroundColor: '#fff',
                borderRadius: '8px',
                width: '100%',
                maxWidth: '900px',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                overflow: 'hidden',
                position: 'relative'
            }}>
                {/* Header Modal */}
                <div style={{
                    padding: '16px 48px 16px 20px',
                    borderBottom: '1px solid #dee2e6',
                    backgroundColor: '#f8f9fa'
                }}>
                    <h5 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#212529' }}>
                        Allocation History Log
                    </h5>
                    <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '2px' }}>
                        PO: <strong>{poNumber}</strong> | Lot: <strong>{lotNumber}</strong> | Batch: <strong>{batchNumber}</strong> | Product: <strong>{productCode}{productName ? ` - ${productName}` : ''}</strong>
                        {isCross && <> | PO Product (via mapping): <strong>{poProductCode}</strong></>}
                    </div>
                </div>

                <button
                    type="button"
                    onClick={onClose}
                    title="Close Modal"
                    style={{
                        position: 'absolute',
                        top: '12px',
                        right: '16px',
                        border: 'none',
                        background: 'transparent',
                        fontSize: '24px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        color: '#6c757d',
                        lineHeight: 1,
                        padding: '4px 8px',
                        zIndex: 10
                    }}
                >
                    &times;
                </button>

                {/* Body Modal / Table */}
                <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#0d6efd', fontWeight: 'bold' }}>
                            Loading history logs...
                        </div>
                    ) : error ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#dc3545' }}>
                            {error}
                        </div>
                    ) : logs.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
                            No history changes logged for this allocation.
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6', textAlign: 'left' }}>
                                    <th style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>Date & Time</th>
                                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>Action</th>
                                    <th style={{ padding: '8px 12px' }}>Allocated Qty</th>
                                    <th style={{ padding: '8px 12px' }}>Status</th>
                                    <th style={{ padding: '8px 12px' }}>Reason</th>
                                    <th style={{ padding: '8px 12px' }}>Changed By</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((log) => {
                                    const isInsert = log.action_type === 'INSERT';
                                    const action = getActionInfo(log);
                                    return (
                                        <tr key={log.id} style={{ borderBottom: '1px solid #e9ecef' }}>
                                            <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', fontSize: '12px', color: '#495057' }}>
                                                {formatDateTime(log.created_at)}
                                            </td>
                                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                                <span style={{
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    fontSize: '11px',
                                                    fontWeight: 'bold',
                                                    whiteSpace: 'nowrap',
                                                    backgroundColor: action.backgroundColor,
                                                    color: action.color
                                                }}>
                                                    {action.label}
                                                </span>
                                            </td>
                                            <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                                                {isInsert ? (
                                                    <strong>{formatQty(log.new_allocated_qty)}</strong>
                                                ) : (
                                                    <span>
                                                        {formatQty(log.old_allocated_qty)} &rarr; <strong>{formatQty(log.new_allocated_qty)}</strong>
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                                                {isInsert || !log.old_status ? (
                                                    <span>{log.new_status || 'Open'}</span>
                                                ) : (
                                                    <span>{log.old_status} &rarr; <strong>{log.new_status}</strong></span>
                                                )}
                                            </td>
                                            <td style={{ padding: '8px 12px', color: '#6c757d', maxWidth: '200px', wordBreak: 'break-word' }}>
                                                {log.reason || '-'}
                                            </td>
                                            <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', fontWeight: '500' }}>
                                                {log.created_by_name || 'System'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                <PaginationControl
                    pagination={pagination}
                    onPageChange={onPageChange}
                    onLimitChange={onLimitChange}
                    limitOptions={[10, 25, 50]}
                />
            </div>
        </div>
    );
};

export default AllocationHistoryModal;
