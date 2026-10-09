const DocumentFlowSummaryCards = ({ summary, activeTab, setActiveTab }) => {
    return (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'nowrap', width: '100%' }}>
            {/* Card 1: Valid Data */}
            <div
                onClick={() => setActiveTab('new')}
                style={{
                    flex: '1 1 0px',
                    minWidth: 0,
                    cursor: 'pointer',
                    padding: '8px 8px',
                    borderRadius: '6px',
                    transition: 'all 0.2s ease',
                    backgroundColor: activeTab === 'new' ? '#d1e7dd' : '#f1f9f5',
                    color: '#0f5132',
                    border: activeTab === 'new' ? '2px solid #198754' : '1px solid #badbcc',
                    boxSizing: 'border-box',
                    overflow: 'hidden'
                }}
            >
                <div style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Valid Data</div>
                <div style={{ fontSize: '14px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{summary.newCount || 0} Batch{summary.validRowCount !== undefined ? ` \u00b7 ${summary.validRowCount} Rows` : ''}</div>
            </div>

            {/* Card 2: Duplicate Data */}
            <div
                onClick={() => setActiveTab('duplicate')}
                style={{
                    flex: '1 1 0px',
                    minWidth: 0,
                    cursor: 'pointer',
                    padding: '8px 8px',
                    borderRadius: '6px',
                    transition: 'all 0.2s ease',
                    backgroundColor: activeTab === 'duplicate' ? '#fff3cd' : '#fff9e6',
                    color: '#664d03',
                    border: activeTab === 'duplicate' ? '2px solid #ffc107' : '1px solid #ffecb5',
                    boxSizing: 'border-box',
                    overflow: 'hidden'
                }}
            >
                <div style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Duplicate</div>
                <div style={{ fontSize: '14px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{summary.duplicateCount || 0} Rows</div>
            </div>

            {/* Card 3: SKU Tidak Terdaftar (Unregistered) */}
            <div
                onClick={() => setActiveTab('unregistered')}
                style={{
                    flex: '1 1 0px',
                    minWidth: 0,
                    cursor: 'pointer',
                    padding: '8px 8px',
                    borderRadius: '6px',
                    transition: 'all 0.2s ease',
                    backgroundColor: activeTab === 'unregistered' ? '#f8d7da' : '#fdf2f2',
                    color: '#842029',
                    border: activeTab === 'unregistered' ? '2px solid #dc3545' : '1px solid #f5c2c7',
                    boxSizing: 'border-box',
                    overflow: 'hidden'
                }}
            >
                <div style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Unregistered SKU</div>
                <div style={{ fontSize: '14px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{summary.unregisteredCount || 0} Rows</div>
            </div>
        </div>
    );
};

export default DocumentFlowSummaryCards;
