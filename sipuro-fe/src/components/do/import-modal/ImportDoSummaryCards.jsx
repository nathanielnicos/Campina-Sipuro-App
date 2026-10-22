import React from 'react';

const ImportDoSummaryCards = ({ summary = {}, activeTab, setActiveTab }) => {
    return (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'nowrap', width: '100%' }}>
            {/* Valid Data */}
            <div
                onClick={() => setActiveTab('new')}
                style={{
                    flex: '1 1 0px',
                    minWidth: 0,
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '6px',
                    backgroundColor: activeTab === 'new' ? '#d1e7dd' : '#f1f9f5',
                    color: '#0f5132',
                    border: activeTab === 'new' ? '2px solid #198754' : '1px solid #badbcc'
                }}
            >
                <div style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold' }}>Valid DO</div>
                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{summary.allocatedGroups || 0} DO Group{summary.validRows !== undefined ? ` \u00b7 ${summary.validRows} Rows` : ''}</div>
            </div>

            {/* Unallocated */}
            <div
                onClick={() => setActiveTab('unallocated')}
                style={{
                    flex: '1 1 0px',
                    minWidth: 0,
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '6px',
                    backgroundColor: activeTab === 'unallocated' ? '#cff4fc' : '#e0fbfd',
                    color: '#055160',
                    border: activeTab === 'unallocated' ? '2px solid #0dcaf0' : '1px solid #b6effb'
                }}
            >
                <div style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold' }}>Unallocated</div>
                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{summary.unallocatedRows || 0} Rows</div>
            </div>

            {/* Duplicate */}
            <div
                onClick={() => setActiveTab('duplicate')}
                style={{
                    flex: '1 1 0px',
                    minWidth: 0,
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '6px',
                    backgroundColor: activeTab === 'duplicate' ? '#fff3cd' : '#fff9e6',
                    color: '#664d03',
                    border: activeTab === 'duplicate' ? '2px solid #ffc107' : '1px solid #ffecb5'
                }}
            >
                <div style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold' }}>Duplicate</div>
                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{summary.duplicateRows || 0} Rows</div>
            </div>

            {/* Non-GOOD */}
            <div
                onClick={() => setActiveTab('non_good')}
                style={{
                    flex: '1 1 0px',
                    minWidth: 0,
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '6px',
                    backgroundColor: activeTab === 'non_good' ? '#ffe5d0' : '#fff4eb',
                    color: '#a73a00',
                    border: activeTab === 'non_good' ? '2px solid #fd7e14' : '1px solid #fecba1'
                }}
            >
                <div style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold' }}>Non-GOOD</div>
                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{summary.nonGoodRows || 0} Rows</div>
            </div>

            {/* Unregistered */}
            <div
                onClick={() => setActiveTab('unregistered')}
                style={{
                    flex: '1 1 0px',
                    minWidth: 0,
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '6px',
                    backgroundColor: activeTab === 'unregistered' ? '#f8d7da' : '#fdf2f2',
                    color: '#842029',
                    border: activeTab === 'unregistered' ? '2px solid #dc3545' : '1px solid #f5c2c7'
                }}
            >
                <div style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold' }}>Unregistered</div>
                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{summary.unregisteredRows || 0} Rows</div>
            </div>
        </div>
    );
};

export default ImportDoSummaryCards;
