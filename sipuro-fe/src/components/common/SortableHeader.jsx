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

    const handleClick = () => {
        if (!onSort) return;
        if (isActive) {
            onSort(sortKey, currentSortOrder === 'ASC' ? 'DESC' : 'ASC');
        } else {
            onSort(sortKey, 'ASC');
        }
    };

    const renderSortIcon = () => {
        return (
            <span style={{ marginLeft: '4px', display: 'inline-flex', flexDirection: 'column', fontSize: '9px', lineHeight: '1' }}>
                <span style={{ color: isActive && currentSortOrder === 'ASC' ? '#0d6efd' : '#adb5bd' }}>▲</span>
                <span style={{ color: isActive && currentSortOrder === 'DESC' ? '#0d6efd' : '#adb5bd' }}>▼</span>
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
