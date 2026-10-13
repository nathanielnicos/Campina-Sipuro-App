const CARDS = [
    {
        key: 'new',
        label: 'Valid Data',
        text: (s) => `${s.validCount || 0} Rows`,
        bg: '#f1f9f5', activeBg: '#d1e7dd', color: '#0f5132', border: '#badbcc', activeBorder: '#198754'
    },
    {
        key: 'duplicate',
        label: 'Duplicate',
        text: (s) => `${s.duplicateCount || 0} Rows`,
        bg: '#fff9e6', activeBg: '#fff3cd', color: '#664d03', border: '#ffecb5', activeBorder: '#ffc107'
    },
    {
        key: 'unregistered',
        label: 'Unregistered SKU',
        text: (s) => `${s.unregisteredCount || 0} Rows`,
        bg: '#fdf2f2', activeBg: '#f8d7da', color: '#842029', border: '#f5c2c7', activeBorder: '#dc3545'
    },
    {
        key: 'nonInterfaced',
        label: 'Non-Interfaced Status',
        text: (s) => `${s.nonInterfacedCount || 0} Rows`,
        bg: '#f4f5f7', activeBg: '#e2e3e5', color: '#41464b', border: '#d3d6d8', activeBorder: '#6c757d'
    }
];

const ellipsis = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

const DocumentFlowSummaryCards = ({ summary = {}, activeTab, setActiveTab }) => (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'nowrap', width: '100%' }}>
        {CARDS.map((card) => {
            const active = activeTab === card.key;
            return (
                <div
                    key={card.key}
                    onClick={() => setActiveTab(card.key)}
                    style={{
                        flex: '1 1 0px',
                        minWidth: 0,
                        cursor: 'pointer',
                        padding: '8px',
                        borderRadius: '6px',
                        transition: 'all 0.2s ease',
                        backgroundColor: active ? card.activeBg : card.bg,
                        color: card.color,
                        border: active ? `2px solid ${card.activeBorder}` : `1px solid ${card.border}`,
                        boxSizing: 'border-box',
                        overflow: 'hidden'
                    }}
                >
                    <div style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold', ...ellipsis }}>{card.label}</div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', ...ellipsis }}>{card.text(summary)}</div>
                </div>
            );
        })}
    </div>
);

export default DocumentFlowSummaryCards;
