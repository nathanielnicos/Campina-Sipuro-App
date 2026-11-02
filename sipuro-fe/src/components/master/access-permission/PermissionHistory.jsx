import { useAccessPermissionHistory } from '../../../hooks/master/useAccessPermissionHistory';
import PaginationControl from '../../common/PaginationControl';
import { formatDateTime } from '../../../utils/dateHelper';
import { GROUP_LABELS, ACTION_LABELS } from './permissionLabels';

const PermissionHistory = ({ menus, reloadKey }) => {
    const {
        logs, loading, currentPage, pageSize, totalPages, totalItems, handlePageChange, handleLimitChange
    } = useAccessPermissionHistory(reloadKey);

    const menuLabel = (code) => menus.find((m) => m.code === code)?.label || code;

    if (loading) return <div style={{ padding: '20px', textAlign: 'center', fontSize: '13px', color: '#6c757d' }}>Loading history...</div>;

    return (
        <div style={{ border: '1px solid #dee2e6', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                            <th style={{ padding: '10px' }}>Date and Time</th>
                            <th style={{ padding: '10px' }}>Changed By</th>
                            <th style={{ padding: '10px' }}>Group</th>
                            <th style={{ padding: '10px' }}>Menu</th>
                            <th style={{ padding: '10px' }}>Action</th>
                            <th style={{ padding: '10px' }}>Change</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.length === 0 ? (
                            <tr><td colSpan="6" style={{ padding: '15px', textAlign: 'center' }}>No changes recorded yet</td></tr>
                        ) : (
                            logs.map((log) => (
                                <tr key={log.id} style={{ borderBottom: '1px solid #e9ecef' }}>
                                    <td style={{ padding: '10px' }}>{formatDateTime(log.changedAt)}</td>
                                    <td style={{ padding: '10px' }}>{log.changedBy || '-'}</td>
                                    <td style={{ padding: '10px' }}>{GROUP_LABELS[log.group] || log.group}</td>
                                    <td style={{ padding: '10px' }}>{menuLabel(log.menu)}</td>
                                    <td style={{ padding: '10px' }}>{ACTION_LABELS[log.action] || log.action}</td>
                                    <td style={{ padding: '10px', fontWeight: 'bold', color: log.newAllowed ? '#2f9e44' : '#e03131' }}>
                                        {log.newAllowed ? 'Allowed' : 'Removed'}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            <PaginationControl
                pagination={{ currentPage, totalPages, totalItems, limit: pageSize }}
                onPageChange={handlePageChange}
                onLimitChange={handleLimitChange}
            />
        </div>
    );
};

export default PermissionHistory;
