import DateRangePicker from '../common/DateRangePicker';
import { STATUS_OPTIONS } from '../../utils/outstandingPoHelpers';

const labelStyle = { display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' };
const fieldStyle = { width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da', boxSizing: 'border-box', height: '38px' };

const OutstandingPoFilter = ({ filters, onChange, onReset }) => {
    const isFilterActive = Boolean(filters.product || filters.po || filters.fromDate || filters.toDate || filters.status);

    return (
        <div style={{
            backgroundColor: '#fff',
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid #dee2e6',
            marginBottom: '20px',
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '12px',
            alignItems: 'end'
        }}>
            <div>
                <label style={labelStyle}>Search Product Code/Name</label>
                <input
                    type="text"
                    placeholder="Example: FG-CN-00060"
                    value={filters.product}
                    onChange={(e) => onChange('product', e.target.value)}
                    style={fieldStyle}
                />
            </div>

            <div>
                <label style={labelStyle}>Search PO Number</label>
                <input
                    type="text"
                    placeholder="Example: PO-20260824-895"
                    value={filters.po}
                    onChange={(e) => onChange('po', e.target.value)}
                    style={fieldStyle}
                />
            </div>

            <DateRangePicker
                label="PO Created Date Range"
                fromDate={filters.fromDate}
                toDate={filters.toDate}
                onFromDateChange={(e) => onChange('fromDate', e.target.value)}
                onToDateChange={(e) => onChange('toDate', e.target.value)}
            />

            <div>
                <label style={labelStyle}>Status Item</label>
                <select
                    value={filters.status}
                    onChange={(e) => onChange('status', e.target.value)}
                    style={{ ...fieldStyle, backgroundColor: '#fff' }}
                >
                    <option value="">All Status</option>
                    {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>{status}</option>
                    ))}
                </select>
            </div>

            <div>
                <button
                    type="button"
                    onClick={onReset}
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

export default OutstandingPoFilter;
