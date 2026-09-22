const SummaryCards = ({ summary, activeTab, setActiveTab }) => {
    return (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {/* Card 1: Valid Data */}
            <div
                onClick={() => setActiveTab('new')}
                style={{
                    flex: 1, minWidth: '140px', cursor: 'pointer', padding: '8px 12px', borderRadius: '6px',
                    transition: 'all 0.2s ease',
                    backgroundColor: activeTab === 'new' ? '#d1e7dd' : '#f1f9f5',
                    color: '#0f5132',
                    border: activeTab === 'new' ? '2px solid #198754' : '1px solid #badbcc'
                }}
            >
                <div style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold' }}>Valid Data</div>
                <div style={{ fontSize: '15px', fontWeight: 'bold' }}>{summary.newCount || 0} Items</div>
            </div>

            {/* Card 2: Unallocated Stock (Belum Dialokasikan ke PO) */}
            <div
                onClick={() => setActiveTab('unallocated')}
                style={{
                    flex: 1, minWidth: '140px', cursor: 'pointer', padding: '8px 12px', borderRadius: '6px',
                    transition: 'all 0.2s ease',
                    backgroundColor: activeTab === 'unallocated' ? '#cff4fc' : '#e0fbfd',
                    color: '#055160',
                    border: activeTab === 'unallocated' ? '2px solid #0dcaf0' : '1px solid #b6effb'
                }}
            >
                <div style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold' }}>Unallocated</div>
                <div style={{ fontSize: '15px', fontWeight: 'bold' }}>{summary.unallocatedCount || 0} Rows</div>
            </div>

            {/* Card 3: Duplicate Data */}
            <div
                onClick={() => setActiveTab('duplicate')}
                style={{
                    flex: 1, minWidth: '140px', cursor: 'pointer', padding: '8px 12px', borderRadius: '6px',
                    transition: 'all 0.2s ease',
                    backgroundColor: activeTab === 'duplicate' ? '#fff3cd' : '#fff9e6',
                    color: '#664d03',
                    border: activeTab === 'duplicate' ? '2px solid #ffc107' : '1px solid #ffecb5'
                }}
            >
                <div style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold' }}>Duplicate</div>
                <div style={{ fontSize: '15px', fontWeight: 'bold' }}>{summary.duplicateCount || 0} Rows</div>
            </div>

            {/* Card 4: Duplicate Status Update Only */}
            <div
                onClick={() => setActiveTab('duplicate_status_update')}
                style={{
                    flex: 1, minWidth: '140px', cursor: 'pointer', padding: '8px 12px', borderRadius: '6px',
                    transition: 'all 0.2s ease',
                    backgroundColor: activeTab === 'duplicate_status_update' ? '#e2e3e5' : '#f8f9fa',
                    color: '#383d41',
                    border: activeTab === 'duplicate_status_update' ? '2px solid #6c757d' : '1px solid #d6d8db'
                }}
            >
                <div style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold' }}>Status Update</div>
                <div style={{ fontSize: '15px', fontWeight: 'bold' }}>{summary.duplicateStatusUpdateCount || 0} Rows</div>
            </div>

            {/* Card 5: Non-GOOD Status */}
            <div
                onClick={() => setActiveTab('non_good')}
                style={{
                    flex: 1, minWidth: '140px', cursor: 'pointer', padding: '8px 12px', borderRadius: '6px',
                    transition: 'all 0.2s ease',
                    backgroundColor: activeTab === 'non_good' ? '#ffe5d0' : '#fff4eb',
                    color: '#a73a00',
                    border: activeTab === 'non_good' ? '2px solid #fd7e14' : '1px solid #fecba1'
                }}
            >
                <div style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold' }}>Non-GOOD Status</div>
                <div style={{ fontSize: '15px', fontWeight: 'bold' }}>{summary.nonGoodCount || 0} Rows</div>
            </div>

            {/* Card 6: SKU Tidak Terdaftar (Unregistered) */}
            <div
                onClick={() => setActiveTab('unregistered')}
                style={{
                    flex: 1, minWidth: '140px', cursor: 'pointer', padding: '8px 12px', borderRadius: '6px',
                    transition: 'all 0.2s ease',
                    backgroundColor: activeTab === 'unregistered' ? '#f8d7da' : '#fdf2f2',
                    color: '#842029',
                    border: activeTab === 'unregistered' ? '2px solid #dc3545' : '1px solid #f5c2c7'
                }}
            >
                <div style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold' }}>Unregistered SKU</div>
                <div style={{ fontSize: '15px', fontWeight: 'bold' }}>{summary.unregisteredCount || 0} Rows</div>
            </div>
        </div>
    );
};

export default SummaryCards;
