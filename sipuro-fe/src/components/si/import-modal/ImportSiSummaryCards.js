import React from 'react';

const ImportSiSummaryCards = ({ summary = {}, activeTab, setActiveTab }) => {
    return (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'nowrap', width: '100%' }}>
            <div
                onClick={() => setActiveTab('valid')}
                style={{
                    flex: '1 1 0px', cursor: 'pointer', padding: '8px', borderRadius: '6px',
                    backgroundColor: activeTab === 'valid' ? '#d1e7dd' : '#f1f9f5', color: '#0f5132',
                    border: activeTab === 'valid' ? '2px solid #198754' : '1px solid #badbcc'
                }}
            >
                <div style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold' }}>Valid Data</div>
                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{summary.validCount || 0} Rows</div>
            </div>

            <div
                onClick={() => setActiveTab('unallocated')}
                style={{
                    flex: '1 1 0px', cursor: 'pointer', padding: '8px', borderRadius: '6px',
                    backgroundColor: activeTab === 'unallocated' ? '#cff4fc' : '#e0fbfd', color: '#055160',
                    border: activeTab === 'unallocated' ? '2px solid #0dcaf0' : '1px solid #b6effb'
                }}
            >
                <div style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold' }}>Unallocated (No DO)</div>
                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{summary.unallocatedCount || 0} Rows</div>
            </div>

            <div
                onClick={() => setActiveTab('duplicate')}
                style={{
                    flex: '1 1 0px', cursor: 'pointer', padding: '8px', borderRadius: '6px',
                    backgroundColor: activeTab === 'duplicate' ? '#fff3cd' : '#fff9e6', color: '#664d03',
                    border: activeTab === 'duplicate' ? '2px solid #ffc107' : '1px solid #ffecb5'
                }}
            >
                <div style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold' }}>Duplicate</div>
                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{summary.duplicateCount || 0} Rows</div>
            </div>

            <div
                onClick={() => setActiveTab('non_interfaced')}
                style={{
                    flex: '1 1 0px', cursor: 'pointer', padding: '8px', borderRadius: '6px',
                    backgroundColor: activeTab === 'non_interfaced' ? '#e2e3e5' : '#f8f9fa', color: '#41464b',
                    border: activeTab === 'non_interfaced' ? '2px solid #6c757d' : '1px solid #d3d6d8'
                }}
            >
                <div style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold' }}>Non-Interfaced</div>
                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{summary.nonInterfacedCount || 0} Rows</div>
            </div>

            <div
                onClick={() => setActiveTab('unregistered')}
                style={{
                    flex: '1 1 0px', cursor: 'pointer', padding: '8px', borderRadius: '6px',
                    backgroundColor: activeTab === 'unregistered' ? '#f8d7da' : '#fdf2f2', color: '#842029',
                    border: activeTab === 'unregistered' ? '2px solid #dc3545' : '1px solid #f5c2c7'
                }}
            >
                <div style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold' }}>Unregistered SKU</div>
                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{summary.unregisteredCount || 0} Rows</div>
            </div>
        </div>
    );
};

export default ImportSiSummaryCards;
