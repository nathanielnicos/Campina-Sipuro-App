import React from 'react';
import DateRangePicker from '../../common/DateRangePicker';

const DoFilter = ({
    searchQuery,
    fromDoDate,
    toDoDate,
    onSearchChange,
    onFromDoDateChange,
    onToDoDateChange,
    onResetFilters,
    showEstimatedPoToggle = false,
    estimatedPoOn = false,
    onToggleEstimatedPo,
    canExport = false,
    exporting = false,
    onExport
}) => {
    const isFilterActive = Boolean(searchQuery || fromDoDate || toDoDate);
    const getValue = (e) => (e?.target ? e.target.value : e);

    return (
        <div style={{
            backgroundColor: '#fff',
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid #dee2e6',
            marginBottom: '20px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px',
            alignItems: 'end'
        }}>
            <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Search DO Data</label>
                <input
                    type="text"
                    placeholder="Search DO / Return / Lot / Product..."
                    value={searchQuery}
                    onChange={onSearchChange}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da', boxSizing: 'border-box', height: '38px' }}
                />
            </div>

            <DateRangePicker
                label="Date Range"
                fromDate={fromDoDate}
                toDate={toDoDate}
                onFromDateChange={(e) => onFromDoDateChange(getValue(e))}
                onToDateChange={(e) => onToDoDateChange(getValue(e))}
            />

            {showEstimatedPoToggle && (
                <div>
                    <button
                        type="button"
                        onClick={onToggleEstimatedPo}
                        aria-pressed={estimatedPoOn}
                        title="Show a FIFO estimate of which PO each DO belongs to"
                        style={{
                            width: '100%',
                            padding: '8px 12px',
                            backgroundColor: estimatedPoOn ? '#0d6efd' : '#fff',
                            color: estimatedPoOn ? '#fff' : '#0d6efd',
                            border: '1px solid #0d6efd',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            height: '38px',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        {estimatedPoOn ? 'Hide Estimated PO' : 'Show Estimated PO'}
                    </button>
                </div>
            )}

            {canExport && (
                <div>
                    <button
                        type="button"
                        onClick={onExport}
                        disabled={exporting}
                        title="Download Delivery Orders, returns and lot balance as Excel (uses the current search and date range)"
                        style={{
                            width: '100%',
                            padding: '8px 12px',
                            backgroundColor: '#198754',
                            color: '#fff',
                            border: '1px solid #198754',
                            borderRadius: '4px',
                            cursor: exporting ? 'not-allowed' : 'pointer',
                            fontWeight: 'bold',
                            whiteSpace: 'nowrap',
                            height: '38px',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        {exporting ? 'Downloading...' : 'Export Excel'}
                    </button>
                </div>
            )}

            <div>
                <button
                    onClick={onResetFilters}
                    disabled={!isFilterActive}
                    style={{
                        width: '100%',
                        padding: '8px 12px',
                        backgroundColor: isFilterActive ? '#dc3545' : '#e9ecef',
                        color: isFilterActive ? '#fff' : '#adb5bd',
                        border: isFilterActive ? '1px solid #dc3545' : '1px solid #ced4da',
                        borderRadius: '4px',
                        cursor: isFilterActive ? 'pointer' : 'not-allowed',
                        fontWeight: 'bold',
                        height: '38px',
                        transition: 'all 0.2s ease'
                    }}
                >
                    Reset Filters
                </button>
            </div>
        </div>
    );
};

export default DoFilter;
