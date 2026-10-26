import React from 'react';
import DateRangePicker from '../../common/DateRangePicker';

const SalesInvoiceFilter = ({ searchQuery, fromSiDate, toSiDate, onSearchChange, onFromSiDateChange, onToSiDateChange, onResetFilters }) => {
    const isFilterActive = Boolean(searchQuery || fromSiDate || toSiDate);
    const getValue = (e) => (e?.target ? e.target.value : e);

    return (
        <div style={{
            backgroundColor: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #dee2e6',
            marginBottom: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', alignItems: 'end'
        }}>
            <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Search SI Data</label>
                <input
                    type="text"
                    placeholder="Search SI / DO / Product..."
                    value={searchQuery}
                    onChange={onSearchChange}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da', boxSizing: 'border-box', height: '38px' }}
                />
            </div>

            <DateRangePicker
                label="SI Date Range"
                fromDate={fromSiDate}
                toDate={toSiDate}
                onFromDateChange={(e) => onFromSiDateChange(getValue(e))}
                onToDateChange={(e) => onToSiDateChange(getValue(e))}
            />

            <div>
                <button
                    onClick={onResetFilters}
                    disabled={!isFilterActive}
                    style={{
                        width: '100%', padding: '8px 12px',
                        backgroundColor: isFilterActive ? '#dc3545' : '#e9ecef',
                        color: isFilterActive ? '#fff' : '#adb5bd',
                        border: isFilterActive ? '1px solid #dc3545' : '1px solid #ced4da',
                        borderRadius: '4px', cursor: isFilterActive ? 'pointer' : 'not-allowed',
                        fontWeight: 'bold', height: '38px'
                    }}
                >
                    Reset Filters
                </button>
            </div>
        </div>
    );
};

export default SalesInvoiceFilter;
