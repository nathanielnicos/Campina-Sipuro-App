import React from 'react';

const buttonStyle = (isActive) => ({
    padding: '6px 14px',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
    backgroundColor: isActive ? '#0d6efd' : 'transparent',
    color: isActive ? '#fff' : '#6c757d',
    transition: 'all 0.2s'
});

const groupStyle = { display: 'flex', backgroundColor: '#e9ecef', borderRadius: '6px', padding: '3px', gap: '2px' };

const VIEW_MODES = [
    { value: 'DO', label: 'DO Number' },
    { value: 'RETURN', label: 'Return Number' },
    { value: 'LOT', label: 'Lot Number' },
    { value: 'READY', label: 'Ready to Ship' }
];

const DoViewModeSwitcher = ({ viewMode, onViewModeChange, detailLevel, onDetailLevelChange }) => (
    <>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#495057' }}>Display Data By:</span>
            <div style={groupStyle}>
                {VIEW_MODES.map((mode) => (
                    <button key={mode.value} type="button" onClick={() => onViewModeChange(mode.value)} style={buttonStyle(viewMode === mode.value)}>
                        {mode.label}
                    </button>
                ))}
            </div>
        </div>

        {/* Tingkat detail untuk tampilan DO Number dan Return Number (tampilan Lot Number sudah per lot) */}
        {(viewMode === 'DO' || viewMode === 'RETURN') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 16px', borderBottom: '1px solid #dee2e6', backgroundColor: '#fff' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#6c757d' }}>Detail Level:</span>
                <div role="group" aria-label="Detail level" style={groupStyle}>
                    <button type="button" onClick={() => onDetailLevelChange('SUMMARY')} style={buttonStyle(detailLevel === 'SUMMARY')}>Summary</button>
                    <button type="button" onClick={() => onDetailLevelChange('LOT')} style={buttonStyle(detailLevel === 'LOT')}>Per Lot</button>
                </div>
            </div>
        )}
    </>
);

export default DoViewModeSwitcher;
