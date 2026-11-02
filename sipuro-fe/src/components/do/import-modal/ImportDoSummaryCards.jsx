import React from 'react';

const CARDS = [
    { key: 'new', title: 'Valid DO', bg: '#f1f9f5', activeBg: '#d1e7dd', color: '#0f5132', border: '#badbcc', activeBorder: '#198754',
        text: (s) => `${s.doLineCount || 0} Lines · ${s.validDoRows || 0} Rows` },
    { key: 'returns', title: 'Valid Returns', bg: '#f3f0ff', activeBg: '#e5dbff', color: '#3d2a7a', border: '#d0bfff', activeBorder: '#7048e8',
        text: (s) => `${s.returnLineCount || 0} Lines · ${s.validReturnRows || 0} Rows` },
    { key: 'unallocated', title: 'Unallocated', bg: '#e0fbfd', activeBg: '#cff4fc', color: '#055160', border: '#b6effb', activeBorder: '#0dcaf0',
        text: (s) => `${s.unallocatedRows || 0} Rows` },
    { key: 'duplicate', title: 'Duplicate', bg: '#fff9e6', activeBg: '#fff3cd', color: '#664d03', border: '#ffecb5', activeBorder: '#ffc107',
        text: (s) => `${s.duplicateRows || 0} Rows` },
    { key: 'non_good', title: 'Non-GOOD', bg: '#fff4eb', activeBg: '#ffe5d0', color: '#a73a00', border: '#fecba1', activeBorder: '#fd7e14',
        text: (s) => `${s.nonGoodRows || 0} Rows` },
    { key: 'unregistered', title: 'Unregistered', bg: '#fdf2f2', activeBg: '#f8d7da', color: '#842029', border: '#f5c2c7', activeBorder: '#dc3545',
        text: (s) => `${s.unregisteredRows || 0} Rows` }
];

const ImportDoSummaryCards = ({ summary = {}, activeTab, setActiveTab }) => (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'nowrap', width: '100%' }}>
        {CARDS.map((card) => {
            const isActive = activeTab === card.key;
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
                        backgroundColor: isActive ? card.activeBg : card.bg,
                        color: card.color,
                        border: isActive ? `2px solid ${card.activeBorder}` : `1px solid ${card.border}`
                    }}
                >
                    <div style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold' }}>{card.title}</div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{card.text(summary)}</div>
                </div>
            );
        })}
    </div>
);

export default ImportDoSummaryCards;
