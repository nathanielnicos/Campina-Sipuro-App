import { useUploadPreviewModal } from '../../hooks/master/useUploadPreviewModal';

const UploadPreviewModal = ({ title, previewData, onClose, onConfirm, isCommitting }) => {
    const {
        activeTab,
        setActiveTab,
        summary,
        filteredData,
        hasChangesToSave,
        handleSave,
        getStatusBadgeProps,
        getRowStyle
    } = useUploadPreviewModal({ previewData, onConfirm });

    if (!previewData || !previewData.data) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            boxSizing: 'border-box'
        }}>
            <div style={{
                backgroundColor: '#fff',
                borderRadius: '8px',
                width: '900px',
                maxWidth: '95%',
                maxHeight: '85vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                overflow: 'hidden',
                boxSizing: 'border-box'
            }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #dee2e6' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#212529' }}>
                        Preview Upload: {title}
                    </h3>
                </div>

                <div style={{
                    padding: '12px 20px',
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'center',
                    backgroundColor: '#f8f9fa',
                    borderBottom: '1px solid #e9ecef',
                    flexWrap: 'wrap'
                }}>
                    <button
                        onClick={() => setActiveTab('ALL')}
                        style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', backgroundColor: activeTab === 'ALL' ? '#0d6efd' : '#e9ecef', color: activeTab === 'ALL' ? '#fff' : '#495057' }}
                    >
                        All ({summary.total})
                    </button>
                    {summary.newCount > 0 && (
                        <button
                            onClick={() => setActiveTab('NEW')}
                            style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', backgroundColor: activeTab === 'NEW' ? '#198754' : '#d1e7dd', color: activeTab === 'NEW' ? '#fff' : '#0f5132' }}
                        >
                            New Data: {summary.newCount}
                        </button>
                    )}
                    {summary.updatedCount > 0 && (
                        <button
                            onClick={() => setActiveTab('UPDATED')}
                            style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', backgroundColor: activeTab === 'UPDATED' ? '#fd7e14' : '#ffe5d0', color: activeTab === 'UPDATED' ? '#fff' : '#a73a00' }}
                        >
                            Updated Data: {summary.updatedCount}
                        </button>
                    )}
                    {summary.unchangedCount > 0 && (
                        <button
                            onClick={() => setActiveTab('UNCHANGED')}
                            style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', backgroundColor: activeTab === 'UNCHANGED' ? '#6c757d' : '#e2e3e5', color: activeTab === 'UNCHANGED' ? '#fff' : '#41464b' }}
                        >
                            Unchanged: {summary.unchangedCount}
                        </button>
                    )}
                    {summary.notFoundCount > 0 && (
                        <button
                            onClick={() => setActiveTab('NOT_FOUND')}
                            style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', backgroundColor: activeTab === 'NOT_FOUND' ? '#dc3545' : '#f8d7da', color: activeTab === 'NOT_FOUND' ? '#fff' : '#842029' }}
                        >
                            SKU Not Found: {summary.notFoundCount}
                        </button>
                    )}
                </div>

                <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, boxSizing: 'border-box' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left', tableLayout: 'fixed' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f1f3f5', borderBottom: '2px solid #dee2e6' }}>
                                <th style={{ padding: '8px', width: '130px', textAlign: 'center' }}>Status</th>
                                <th style={{ padding: '8px', width: '120px' }}>Oracle Code</th>
                                <th style={{ padding: '8px' }}>Description / Name</th>
                                <th style={{ padding: '8px', width: '280px' }}>Change Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: '#6c757d' }}>No data available in this category.</td>
                                </tr>
                            ) : (
                                filteredData.map((item, idx) => {
                                    const badge = getStatusBadgeProps(item.status);
                                    return (
                                        <tr key={idx} style={{ borderBottom: '1px solid #e9ecef', ...getRowStyle(item.status) }}>
                                            <td style={{ padding: '8px', verticalAlign: 'top', width: '130px' }}>
                                                <span style={badge.style}>{badge.label}</span>
                                            </td>
                                            <td style={{ padding: '8px', fontWeight: 'bold', verticalAlign: 'top', wordBreak: 'break-word' }}>
                                                {item.product_code}
                                            </td>
                                            <td style={{ padding: '8px', verticalAlign: 'top', wordBreak: 'break-word' }}>
                                                {item.description || item.product_name}
                                            </td>
                                            <td style={{ padding: '8px', verticalAlign: 'top' }}>
                                                {item.status === 'NOT_FOUND' ? (
                                                    <span style={{ color: '#dc3545', fontStyle: 'italic' }}>
                                                        Product not registered in Product Master
                                                    </span>
                                                ) : item.changes && item.changes.length > 0 ? (
                                                    <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                                        {item.changes.map((ch, cIdx) => (
                                                            <li key={cIdx} style={{ marginBottom: '2px' }}>
                                                                <strong>{ch.field}:</strong> {ch.oldVal ?? '-'} &rarr; <strong>{ch.newVal ?? '-'}</strong>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    '-'
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                <div style={{ padding: '12px 20px', borderTop: '1px solid #dee2e6', display: 'flex', justifyContent: 'flex-end', gap: '8px', backgroundColor: '#fff' }}>
                    <button
                        onClick={onClose}
                        disabled={isCommitting}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#e0e0e0',
                            color: '#333',
                            border: 'none',
                            borderRadius: '4px',
                            fontWeight: 'bold',
                            fontSize: '13px',
                            cursor: isCommitting ? 'not-allowed' : 'pointer',
                            opacity: isCommitting ? 0.6 : 1,
                            transition: 'all 0.2s ease-in-out'
                        }}
                    >
                        Cancel
                    </button>
                    {hasChangesToSave && (
                        <button
                            onClick={handleSave}
                            disabled={isCommitting}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: '#0d6efd',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                fontWeight: 'bold',
                                fontSize: '13px',
                                cursor: isCommitting ? 'not-allowed' : 'pointer',
                                opacity: isCommitting ? 0.6 : 1,
                                transition: 'all 0.2s ease-in-out'
                            }}
                        >
                            {isCommitting ? 'Saving...' : 'Save to Database'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UploadPreviewModal;
