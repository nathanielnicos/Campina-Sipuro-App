import React from 'react';
import DateRangePicker from '../../common/DateRangePicker';

const Filter = ({
    searchStock,
    fromProdDate,
    toProdDate,
    onSearchChange,
    onFromProdDateChange,
    onToProdDateChange,
    onResetFilters
}) => {
    const isFilterActive = Boolean(searchStock || fromProdDate || toProdDate);

    return (
        <div style={{
            backgroundColor: '#fff',
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid #dee2e6',
            marginBottom: '20px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '12px',
            alignItems: 'end'
        }}>
            <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                    Search Source Batch / Product
                </label>
                <input
                    type="text"
                    placeholder="Example: BAT260824003"
                    value={searchStock}
                    onChange={onSearchChange}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da', boxSizing: 'border-box', height: '38px' }}
                />
            </div>

            <DateRangePicker
                label="Production Date Range"
                fromDate={fromProdDate}
                toDate={toProdDate}
                onFromDateChange={onFromProdDateChange}
                onToDateChange={onToProdDateChange}
            />

            <div>
                <button
                    onClick={onResetFilters}
                    disabled={!isFilterActive}
                    style={{
                        width: '100%',
                        height: '38px',
                        padding: '8px 12px',
                        backgroundColor: isFilterActive ? '#dc3545' : '#e9ecef',
                        color: isFilterActive ? '#fff' : '#adb5bd',
                        border: isFilterActive ? '1px solid #dc3545' : '1px solid #ced4da',
                        borderRadius: '4px',
                        cursor: isFilterActive ? 'pointer' : 'not-allowed',
                        fontWeight: 'bold',
                        transition: 'all 0.2s ease'
                    }}
                >
                    Reset Filters
                </button>
            </div>
        </div>
    );
};

export default Filter;
