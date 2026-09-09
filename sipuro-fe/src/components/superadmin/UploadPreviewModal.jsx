import { useState } from 'react';

const UploadPreviewModal = ({ title, previewData, onClose, onConfirm }) => {
    const [activeTab, setActiveTab] = useState('ALL');

    if (!previewData || !previewData.data) return null;

    const { summary, data } = previewData;
    const { total = 0, newCount = 0, updatedCount = 0, unchangedCount = 0, notFoundCount = 0 } = summary || {};

    // Tombol Simpan HANYA aktif jika ada data Baru atau Data Berubah
    const hasChangesToSave = (newCount + updatedCount) > 0;

    // Filter list berdasarkan Tab aktif
    const filteredData = data.filter(item => {
        if (activeTab === 'NEW') return item.status === 'NEW';
        if (activeTab === 'UPDATED') return item.status === 'UPDATED';
        if (activeTab === 'UNCHANGED') return item.status === 'UNCHANGED';
        if (activeTab === 'NOT_FOUND') return item.status === 'NOT_FOUND';
        return true;
    });

    const renderStatusBadge = (status) => {
        const badgeBaseStyle = {
            display: 'block',
            width: '100%',
            padding: '4px 0',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: 'bold',
            textAlign: 'center',
            boxSizing: 'border-box',
            whiteSpace: 'nowrap',
            lineHeight: '1.2'
        };

        switch (status) {
            case 'NEW':
                return <span style={{ ...badgeBaseStyle, backgroundColor: '#198754', color: '#fff' }}>NEW</span>;
            case 'UPDATED':
                return <span style={{ ...badgeBaseStyle, backgroundColor: '#fd7e14', color: '#fff' }}>UPDATED</span>;
            case 'NOT_FOUND':
                return <span style={{ ...badgeBaseStyle, backgroundColor: '#dc3545', color: '#fff' }}>SKU NOT FOUND</span>;
            default:
                return <span style={{ ...badgeBaseStyle, backgroundColor: '#6c757d', color: '#fff' }}>UNCHANGED</span>;
        }
    };

    const renderRowStyle = (status) => {
        switch (status) {
            case 'NEW':
                return { backgroundColor: '#e8f5e9' };
            case 'UPDATED':
                return { backgroundColor: '#fff8e1' };
            case 'NOT_FOUND':
                return { backgroundColor: '#ffebee' };
            default:
                return {};
        }
    };

    const handleSave = () => {
        const isConfirmed = window.confirm('Are you sure you want to save this data to the database?');
        if (isConfirmed) {
            onConfirm(data);
        }
    };

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
                {/* Modal Header */}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #dee2e6' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#212529' }}>
                        Preview Upload: {title}
                    </h3>
                </div>

                {/* Summary Badges / Filter Tabs Header */}
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
                        All ({total})
                    </button>
                    {newCount > 0 && (
                        <button
                            onClick={() => setActiveTab('NEW')}
                            style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', backgroundColor: activeTab === 'NEW' ? '#198754' : '#d1e7dd', color: activeTab === 'NEW' ? '#fff' : '#0f5132' }}
                        >
                            New Data: {newCount}
                        </button>
                    )}
                    {updatedCount > 0 && (
                        <button
                            onClick={() => setActiveTab('UPDATED')}
                            style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', backgroundColor: activeTab === 'UPDATED' ? '#fd7e14' : '#ffe5d0', color: activeTab === 'UPDATED' ? '#fff' : '#a73a00' }}
                        >
                            Updated Data: {updatedCount}
                        </button>
                    )}
                    {unchangedCount > 0 && (
                        <button
                            onClick={() => setActiveTab('UNCHANGED')}
                            style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', backgroundColor: activeTab === 'UNCHANGED' ? '#6c757d' : '#e2e3e5', color: activeTab === 'UNCHANGED' ? '#fff' : '#41464b' }}
                        >
                            Unchanged: {unchangedCount}
                        </button>
                    )}
                    {notFoundCount > 0 && (
                        <button
                            onClick={() => setActiveTab('NOT_FOUND')}
                            style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', backgroundColor: activeTab === 'NOT_FOUND' ? '#dc3545' : '#f8d7da', color: activeTab === 'NOT_FOUND' ? '#fff' : '#842029' }}
                        >
                            SKU Not Found: {notFoundCount}
                        </button>
                    )}
                </div>

                {/* Table Preview Body */}
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
                                filteredData.map((item, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid #e9ecef', ...renderRowStyle(item.status) }}>
                                        <td style={{ padding: '8px', verticalAlign: 'top', width: '130px' }}>
                                            {renderStatusBadge(item.status)}
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
                                                            <strong>{ch.field}:</strong> {ch.oldVal} &rarr; <strong>{ch.newVal}</strong>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                '-'
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer Buttons */}
                <div style={{ padding: '12px 20px', borderTop: '1px solid #dee2e6', display: 'flex', justifyContent: 'flex-end', gap: '8px', backgroundColor: '#fff' }}>
                    <button
                        onClick={onClose}
                        style={{ padding: '8px 16px', backgroundColor: '#e0e0e0', color: '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
                    >
                        Cancel
                    </button>
                    {hasChangesToSave && (
                        <button
                            onClick={handleSave}
                            style={{ padding: '8px 16px', backgroundColor: '#0d6efd', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
                        >
                            Save to Database
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UploadPreviewModal;
