import { useProductCodeMappingList } from '../../../hooks/master/useProductCodeMappingList';
import PaginationControl from '../../common/PaginationControl';
import AddMappingModal from './AddMappingModal';
import { ProductLabel } from './ProductPicker';
import { getStatusStyle } from '../../../utils/statusHelper';
import { formatDateTime } from '../../../utils/dateHelper';
import { isFlagOn } from '../../../utils/flagHelper';

const ProductCodeMappingPage = () => {
    const {
        mappings,
        loadingData,
        busyId,
        addOpen,
        setAddOpen,
        search,
        currentPage,
        pageSize,
        totalPages,
        totalItems,
        handleSearchChange,
        handleResetFilter,
        handlePageChange,
        handleLimitChange,
        handleToggleStatus,
        handleCreated
    } = useProductCodeMappingList();

    return (
        <div style={{ fontFamily: 'sans-serif' }}>
            <div style={{
                backgroundColor: '#fff',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid #dee2e6',
                marginBottom: '20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                flexWrap: 'wrap',
                gap: '12px'
            }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                    <div style={{ minWidth: '220px' }}>
                        <label htmlFor="mapping-search" style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                            Search Code / Product Name
                        </label>
                        <input
                            id="mapping-search"
                            type="text"
                            placeholder="Search product code or name..."
                            aria-label="Search mappings"
                            value={search}
                            onChange={handleSearchChange}
                            style={{ width: '100%', padding: '7px 10px', borderRadius: '4px', border: '1px solid #ced4da', boxSizing: 'border-box', fontSize: '13px' }}
                        />
                    </div>
                    {search && (
                        <button
                            type="button"
                            onClick={handleResetFilter}
                            style={{
                                padding: '8px 12px',
                                backgroundColor: '#dc3545',
                                color: '#fff',
                                border: '1px solid #dc3545',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                fontSize: '13px'
                            }}
                        >
                            Reset Filter
                        </button>
                    )}
                </div>

                <button
                    type="button"
                    onClick={() => setAddOpen(true)}
                    style={{
                        padding: '6px 12px',
                        backgroundColor: '#198754',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        fontWeight: 'bold',
                        fontSize: '12px',
                        cursor: 'pointer'
                    }}
                >
                    + Add Mapping
                </button>
            </div>

            {loadingData ? (
                <div>Loading mapping data...</div>
            ) : (
                <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #dee2e6', overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                                    <th style={{ padding: '10px' }}>Old Product Code</th>
                                    <th style={{ padding: '10px' }}>New Product Code</th>
                                    <th style={{ padding: '10px' }}>Status</th>
                                    <th style={{ padding: '10px' }}>Created By</th>
                                    <th style={{ padding: '10px' }}>Created At</th>
                                    <th style={{ padding: '10px' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {mappings.length === 0 ? (
                                    <tr><td colSpan="6" style={{ padding: '15px', textAlign: 'center' }}>No mapping data available</td></tr>
                                ) : (
                                    mappings.map((m) => {
                                        const active = isFlagOn(m.is_active);
                                        return (
                                            <tr key={m.id} style={{ borderBottom: '1px solid #e9ecef', opacity: active ? 1 : 0.65 }}>
                                                <td style={{ padding: '10px' }}><ProductLabel product={m.old_product} /></td>
                                                <td style={{ padding: '10px' }}><ProductLabel product={m.new_product} /></td>
                                                <td style={{ padding: '10px' }}>
                                                    <span style={getStatusStyle(active ? 'Active' : 'Inactive')}>{active ? 'Active' : 'Inactive'}</span>
                                                </td>
                                                <td style={{ padding: '10px' }}>{m.created_by_name || '-'}</td>
                                                <td style={{ padding: '10px' }}>{formatDateTime(m.created_at)}</td>
                                                <td style={{ padding: '10px' }}>
                                                    <button
                                                        type="button"
                                                        disabled={busyId === m.id}
                                                        onClick={() => handleToggleStatus(m, active)}
                                                        style={{
                                                            padding: '4px 10px',
                                                            backgroundColor: '#fff',
                                                            color: active ? '#e03131' : '#1971c2',
                                                            border: `1px solid ${active ? '#ffa8a8' : '#a5d8ff'}`,
                                                            borderRadius: '4px',
                                                            fontSize: '12px',
                                                            cursor: busyId === m.id ? 'not-allowed' : 'pointer'
                                                        }}
                                                    >
                                                        {active ? 'Deactivate' : 'Activate'}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    <PaginationControl
                        pagination={{
                            currentPage,
                            totalPages,
                            totalItems,
                            limit: pageSize
                        }}
                        onPageChange={handlePageChange}
                        onLimitChange={handleLimitChange}
                    />
                </div>
            )}

            {addOpen && (
                <AddMappingModal onClose={() => setAddOpen(false)} onCreated={handleCreated} />
            )}
        </div>
    );
};

export default ProductCodeMappingPage;
