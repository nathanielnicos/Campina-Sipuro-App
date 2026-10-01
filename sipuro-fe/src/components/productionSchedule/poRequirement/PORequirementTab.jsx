import { usePORequirement } from '../../../hooks/productionSchedule/usePORequirement';
import PORequirementDetailModal from './PORequirementDetailModal';
import ConfirmCreatePOModal from './ConfirmCreatePOModal';
import { formatQty, formatThousand, unformatThousand } from '../../../utils/formatters';

const PORequirementTab = () => {
    const {
        search,
        setSearch,
        startWeek,
        setStartWeek,
        endWeek,
        setEndWeek,
        data,
        loading,
        handleRequiredQtyChange,
        isModalOpen,
        selectedProduct,
        modalData,
        modalLoading,
        openDetailModal,
        closeModal,
        handleInitCreateDraftPO,
        isConfirmModalOpen,
        setIsConfirmModalOpen,
        customers,
        selectedCustomerId,
        setSelectedCustomerId,
        description,         // Ambil description
        setDescription,      // Ambil setter-nya
        handleConfirmSubmitPO,
        creatingPO
    } = usePORequirement();

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
            <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #dee2e6', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: '16px' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                                <th style={{ padding: '12px 16px', textAlign: 'left', minWidth: '130px', borderRight: '1px solid #dee2e6' }}>
                                    Product Code
                                </th>
                                <th style={{ padding: '12px 16px', textAlign: 'left', minWidth: '220px', borderRight: '1px solid #dee2e6' }}>
                                    Product Name
                                </th>
                                <th style={{ padding: '12px 16px', textAlign: 'right', minWidth: '150px', borderRight: '1px solid #dee2e6' }}>
                                    PO Outstanding (Pcs)
                                </th>
                                <th style={{ padding: '12px 16px', textAlign: 'right', minWidth: '180px', borderRight: '1px solid #dee2e6' }}>
                                    Total Production Plan (Pcs)
                                </th>
                                <th style={{ padding: '12px 16px', textAlign: 'right', minWidth: '150px', borderRight: '1px solid #dee2e6' }}>
                                    Remaining (Pcs)
                                </th>
                                <th style={{ padding: '12px 16px', textAlign: 'center', minWidth: '160px', borderRight: '1px solid #dee2e6' }}>
                                    Required PO (Pcs)
                                </th>
                                <th style={{ padding: '12px 16px', textAlign: 'center', minWidth: '120px' }}>
                                    Action
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: '#6c757d' }}>
                                        Loading data...
                                    </td>
                                </tr>
                            ) : data.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: '#6c757d' }}>
                                        No product requirement data available.
                                    </td>
                                </tr>
                            ) : (
                                data.map((row) => (
                                    <tr key={row.id_product} style={{ borderBottom: '1px solid #e9ecef' }}>
                                        <td style={{ padding: '12px 16px', fontWeight: 'bold', color: '#212529', borderRight: '1px solid #dee2e6' }}>
                                            {row.product_code}
                                        </td>
                                        <td style={{ padding: '12px 16px', color: '#212529', fontWeight: '500', borderRight: '1px solid #dee2e6' }}>
                                            {row.product_name}
                                        </td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', color: '#212529', borderRight: '1px solid #dee2e6' }}>
                                            {formatQty(row.po_outstanding_qty)}
                                        </td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', color: '#212529', borderRight: '1px solid #dee2e6' }}>
                                            {formatQty(row.total_production_plan_qty)}
                                        </td>
                                        <td style={{
                                            padding: '12px 16px',
                                            textAlign: 'right',
                                            fontWeight: 'bold',
                                            color: row.remaining_qty < 0 ? '#dc3545' : '#198754',
                                            borderRight: '1px solid #dee2e6'
                                        }}>
                                            {formatQty(row.remaining_qty)}
                                        </td>
                                        <td style={{ padding: '8px 12px', textAlign: 'center', borderRight: '1px solid #dee2e6' }}>
                                            <input
                                                type="text"
                                                value={formatThousand(row.required_po_qty)}
                                                onChange={(e) => handleRequiredQtyChange(row.id_product, unformatThousand(e.target.value))}
                                                placeholder="0"
                                                style={{
                                                    width: '120px',
                                                    padding: '6px 10px',
                                                    borderRadius: '4px',
                                                    border: '1px solid #ced4da',
                                                    textAlign: 'right',
                                                    fontSize: '13px',
                                                    fontWeight: '600',
                                                    outline: 'none'
                                                }}
                                            />
                                        </td>
                                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                            <button
                                                onClick={() => openDetailModal(row)}
                                                style={{
                                                    backgroundColor: '#0d6efd',
                                                    color: '#fff',
                                                    border: 'none',
                                                    padding: '6px 12px',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontSize: '12px',
                                                    fontWeight: '600'
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
            </div>

            {/* Bottom Action Area */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button
                    onClick={handleInitCreateDraftPO}
                    style={{
                        backgroundColor: '#198754',
                        color: '#fff',
                        border: 'none',
                        padding: '10px 20px',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        transition: 'background-color 0.2s ease'
                    }}
                >
                    Create Draft PO
                </button>
            </div>

            {/* Modal Breakdown Detail */}
            <PORequirementDetailModal
                isOpen={isModalOpen}
                onClose={closeModal}
                product={selectedProduct}
                modalData={modalData}
                loading={modalLoading}
            />

            {/* Modal Konfirmasi Customer & Create PO */}
            <ConfirmCreatePOModal
                isOpen={isConfirmModalOpen}
                onClose={() => setIsConfirmModalOpen(false)}
                items={data}
                customers={customers}
                selectedCustomerId={selectedCustomerId}
                setSelectedCustomerId={setSelectedCustomerId}
                description={description}       // Meneruskan description ke modal
                setDescription={setDescription} // Meneruskan setter ke modal
                onConfirm={handleConfirmSubmitPO}
                loading={creatingPO}
            />
        </div>
    );
};

export default PORequirementTab;
