import React from 'react';

const SummaryCards = ({ summary, activeTab, setActiveTab }) => {
    return (
        <div style={{ display: 'flex', gap: '12px' }}>
            {/* Card 1: Valid Data */}
            <div
                onClick={() => setActiveTab('new')}
                style={{
                    flex: 1,
                    cursor: 'pointer',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    transition: 'all 0.2s ease',
                    backgroundColor: activeTab === 'new' ? '#d1e7dd' : '#f1f9f5',
                    color: '#0f5132',
                    border: activeTab === 'new' ? '2px solid #198754' : '1px solid #badbcc',
                    boxShadow: activeTab === 'new' ? '0 2px 4px rgba(25, 135, 84, 0.2)' : 'none'
                }}
            >
                <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold' }}>
                    Valid Data (To Process)
                </div>
                <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{summary.newCount} Rows</div>
            </div>

            {/* Card 2: Status Non-GOOD */}
            <div
                onClick={() => setActiveTab('non_good')}
                style={{
                    flex: 1,
                    cursor: 'pointer',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    transition: 'all 0.2s ease',
                    backgroundColor: activeTab === 'non_good' ? '#ffe5d0' : '#fff4eb',
                    color: '#a73a00',
                    border: activeTab === 'non_good' ? '2px solid #fd7e14' : '1px solid #fecba1',
                    boxShadow: activeTab === 'non_good' ? '0 2px 4px rgba(253, 126, 20, 0.2)' : 'none'
                }}
            >
                <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold' }}>
                    Non-GOOD Status (Skipped)
                </div>
                <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{summary.nonGoodCount || 0} Rows</div>
            </div>

            {/* Card 3: Duplikat */}
            <div
                onClick={() => setActiveTab('duplicate')}
                style={{
                    flex: 1,
                    cursor: 'pointer',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    transition: 'all 0.2s ease',
                    backgroundColor: activeTab === 'duplicate' ? '#fff3cd' : '#fff9e6',
                    color: '#664d03',
                    border: activeTab === 'duplicate' ? '2px solid #ffc107' : '1px solid #ffecb5',
                    boxShadow: activeTab === 'duplicate' ? '0 2px 4px rgba(255, 193, 7, 0.2)' : 'none'
                }}
            >
                <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold' }}>
                    Duplicate Data (Skipped)
                </div>
                <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{summary.duplicateCount} Rows</div>
            </div>

            {/* Card 4: Tidak Terdaftar */}
            <div
                onClick={() => setActiveTab('unregistered')}
                style={{
                    flex: 1,
                    cursor: 'pointer',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    transition: 'all 0.2s ease',
                    backgroundColor: activeTab === 'unregistered' ? '#f8d7da' : '#fdf2f2',
                    color: '#842029',
                    border: activeTab === 'unregistered' ? '2px solid #dc3545' : '1px solid #f5c2c7',
                    boxShadow: activeTab === 'unregistered' ? '0 2px 4px rgba(220, 53, 69, 0.2)' : 'none'
                }}
            >
                <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold' }}>
                    Unregistered Data (Skipped)
                </div>
                <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{summary.unregisteredCount} Rows</div>
            </div>
        </div>
    );
};

export default SummaryCards;
