import React from 'react';

const SortableHeader = ({
    label,
    sortKey,
    currentSortKey,
    currentSortOrder,
    onSort,
    align = 'left',
    style = {}
}) => {
    const isActive = currentSortKey === sortKey;
    const isAsc = currentSortOrder?.toUpperCase() === 'ASC';

    const handleClick = () => {
        if (!onSort) return;
        if (isActive) {
            onSort(sortKey, isAsc ? 'DESC' : 'ASC');
        } else {
            onSort(sortKey, 'ASC');
        }
    };

    const renderSortIcon = () => {
        return (
            <span style={{ display: 'inline-flex', alignItems: 'center', marginLeft: '6px', verticalAlign: 'middle' }}>
                {!isActive ? (
                    // Default State: Panah ganda atas-bawah (warna abu-abu)
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#adb5bd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m7 15 5 5 5-5" />
                        <path d="m7 9 5-5 5 5" />
                    </svg>
                ) : isAsc ? (
                    // Active ASC: Panah ke atas (warna biru)
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0d6efd" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m7 15 5-5 5 5" />
                    </svg>
                ) : (
                    // Active DESC: Panah ke bawah (warna biru)
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0d6efd" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m7 9 5 5 5-5" />
                    </svg>
                )}
            </span>
        );
    };

    return (
        <th
            onClick={handleClick}
            style={{
                padding: '12px 10px',
                textAlign: align,
                cursor: 'pointer',
                userSelect: 'none',
                whiteSpace: 'nowrap',
                ...style
            }}
        >
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start' }}>
                <span>{label}</span>
                {renderSortIcon()}
            </div>
        </th>
    );
};

export default SortableHeader;
