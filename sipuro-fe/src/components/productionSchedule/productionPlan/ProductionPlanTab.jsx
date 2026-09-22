import { useProductionPlan } from '../../../hooks/productionSchedule/useProductionPlan';
import PaginationControl from '../../common/PaginationControl';
import ProductionPlanModal from '../productionPlan/ProductionPlanModal';
import { formatQty } from '../../../utils/formatters';

const ProductionPlanTab = () => {
    const {
        loading,
        data,
        weeks,
        search,
        setSearch,
        startWeek,
        setStartWeek,
        endWeek,
        setEndWeek,
        pagination,
        handlePageChange,
        handleLimitChange,
        // Modal
        isModalOpen,
        selectedProduct,
        modalWeeks,
        modalStartWeek,
        modalEndWeek,
        revisions,
        setRevisions,
        initialRevisions,
        hasExistingPlan,
        modalLoading,
        saving,
        openModal,
        closeModal,
        handleSave,
        handleModalFilterChange
    } = useProductionPlan();

    return (
        <div>
            {/* Card Container Filter & Search */}
            <div style={{
                backgroundColor: '#fff',
                borderRadius: '8px',
                border: '1px solid #dee2e6',
                padding: '16px 20px',
                marginBottom: '16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                gap: '16px',
                flexWrap: 'wrap'
            }}>
                {/* Search Input Group */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '1', minWidth: '260px', maxWidth: '320px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#212529' }}>
                        Search Product Code / Name
                    </label>
                    <input
                        type="text"
                        placeholder="Example: FG-CN-00060"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{
                            padding: '8px 12px',
                            borderRadius: '4px',
                            border: '1px solid #ced4da',
                            fontSize: '13px',
                            outline: 'none',
                            width: '100%'
                        }}
                    />
                </div>

                {/* Week Filter Range Group */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#212529' }}>
                        Week Range Filter
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                            type="week"
                            value={startWeek}
                            onChange={(e) => setStartWeek(e.target.value)}
                            style={{
                                padding: '8px 12px',
                                borderRadius: '4px',
                                border: '1px solid #ced4da',
                                fontSize: '13px',
                                outline: 'none'
                            }}
                        />
                        <span style={{ fontSize: '13px', color: '#6c757d', fontWeight: '500' }}>to</span>
                        <input
                            type="week"
                            value={endWeek}
                            onChange={(e) => setEndWeek(e.target.value)}
                            style={{
                                padding: '8px 12px',
                                borderRadius: '4px',
                                border: '1px solid #ced4da',
                                fontSize: '13px',
                                outline: 'none'
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Tabel List Utama */}
            <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #dee2e6', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '13px' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                                <th style={{
                                    padding: '12px 16px', textAlign: 'left', minWidth: '130px',
                                    position: 'sticky', left: 0, backgroundColor: '#f8f9fa', zIndex: 10,
                                    borderRight: '1px solid #dee2e6', borderBottom: '2px solid #dee2e6'
                                }}>
                                    Product Code
                                </th>

                                <th style={{
                                    padding: '12px 16px', textAlign: 'left', minWidth: '220px',
                                    position: 'sticky', left: '130px', backgroundColor: '#f8f9fa', zIndex: 10,
                                    borderRight: '1px solid #dee2e6', borderBottom: '2px solid #dee2e6',
                                    boxShadow: '2px 0 5px -2px rgba(0,0,0,0.1)'
                                }}>
                                    Product Name
                                </th>

                                {weeks.map(w => (
                                    <th key={`${w.year}_${w.week_number}`} style={{
                                        padding: '10px 12px', textAlign: 'center', minWidth: '110px',
                                        borderBottom: '2px solid #dee2e6', borderRight: '1px solid #f1f3f5'
                                    }}>
                                        <div>Week {w.week_number}</div>
                                        <div style={{ fontSize: '11px', color: '#6c757d', fontWeight: 'normal' }}>
                                            {w.date_label}
                                        </div>
                                    </th>
                                ))}

                                <th style={{
                                    padding: '12px 16px', textAlign: 'center', minWidth: '110px',
                                    position: 'sticky', right: 0, backgroundColor: '#f8f9fa', zIndex: 10,
                                    borderLeft: '1px solid #dee2e6', borderBottom: '2px solid #dee2e6',
                                    boxShadow: '-2px 0 5px -2px rgba(0,0,0,0.1)'
                                }}>
                                    Action
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={3 + weeks.length} style={{ textAlign: 'center', padding: '30px', color: '#6c757d' }}>
                                        Loading data...
                                    </td>
                                </tr>
                            ) : data.length === 0 ? (
                                <tr>
                                    <td colSpan={3 + weeks.length} style={{ textAlign: 'center', padding: '30px', color: '#6c757d' }}>
                                        No product data available.
                                    </td>
                                </tr>
                            ) : (
                                data.map((row) => (
                                    <tr key={row.id_product} style={{ borderBottom: '1px solid #e9ecef' }}>
                                        <td style={{
                                            padding: '12px 16px', fontWeight: 'bold', color: '#212529',
                                            position: 'sticky', left: 0, backgroundColor: '#fff', zIndex: 5,
                                            borderRight: '1px solid #dee2e6', borderBottom: '1px solid #e9ecef'
                                        }}>
                                            {row.product_code}
                                        </td>

                                        <td style={{
                                            padding: '12px 16px', color: '#212529', fontWeight: '500',
                                            position: 'sticky', left: '130px', backgroundColor: '#fff', zIndex: 5,
                                            borderRight: '1px solid #dee2e6', borderBottom: '1px solid #e9ecef',
                                            boxShadow: '2px 0 5px -2px rgba(0,0,0,0.1)'
                                        }}>
                                            {row.product_name}
                                        </td>

                                        {weeks.map(w => {
                                            const key = `${w.year}_${w.week_number}`;
                                            const qtyVal = row.campina_plans?.[key] ?? 0;

                                            return (
                                                <td key={key} style={{
                                                    padding: '12px', textAlign: 'right', fontWeight: 'bold', color: '#212529',
                                                    borderRight: '1px solid #f1f3f5', borderBottom: '1px solid #e9ecef'
                                                }}>
                                                    {formatQty(qtyVal)}
                                                </td>
                                            );
                                        })}

                                        <td style={{
                                            padding: '12px 16px', textAlign: 'center',
                                            position: 'sticky', right: 0, backgroundColor: '#fff', zIndex: 5,
                                            borderLeft: '1px solid #dee2e6', borderBottom: '1px solid #e9ecef',
                                            boxShadow: '-2px 0 5px -2px rgba(0,0,0,0.1)'
                                        }}>
                                            <button
                                                onClick={() => openModal(row)}
                                                style={{
                                                    backgroundColor: '#0d6efd', color: '#fff', border: 'none',
                                                    padding: '6px 12px', borderRadius: '4px', cursor: 'pointer',
                                                    fontSize: '12px', fontWeight: '600'
                                                }}
                                            >
                                                View Detail
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <PaginationControl
                    pagination={pagination}
                    onPageChange={handlePageChange}
                    onLimitChange={handleLimitChange}
                />
            </div>

            <ProductionPlanModal
                isOpen={isModalOpen}
                onClose={closeModal}
                product={selectedProduct}
                weeks={modalWeeks}
                startWeek={modalStartWeek}
                endWeek={modalEndWeek}
                onFilterChange={handleModalFilterChange}
                revisions={revisions}
                setRevisions={setRevisions}
                initialRevisions={initialRevisions}
                hasExistingPlan={hasExistingPlan}
                loading={modalLoading}
                saving={saving}
                onSave={handleSave}
            />
        </div>
    );
};

export default ProductionPlanTab;
