import { getStatusStyle } from '../../../utils/statusHelper';
import FormHeader from './FormHeader';
import ItemRow from './ItemRow';
import Summary from './Summary';
import Actions from './Actions';
import PaginationControl from '../../common/PaginationControl';

// Import ke-4 Custom Hook
import { useFormHeader } from '../../../hooks/po/detail-modal/useFormHeader';
import { useItemRow } from '../../../hooks/po/detail-modal/useItemRow';
import { useSummary } from '../../../hooks/po/detail-modal/useSummary';
import { useActions } from '../../../hooks/po/detail-modal/useActions';

const DetailModal = ({ poId, currentUser, onClose, onSuccess }) => {
    const userRole = currentUser?.role;

    // 1. Hook Header & Data Fetching
    const {
        poCode,
        poStatus,
        products,
        deliveryAddress,
        description,
        setDescription,
        rejectionReason,
        ppnPercent,
        rawPoItems,
        error,
        isCustomer,
        customerId
    } = useFormHeader({ poId, currentUser });

    // 2. Hook Items Table Management
    const {
        items,
        searchTerm,
        setSearchTerm,
        openDropdown,
        setOpenDropdown,
        currentPage,
        setCurrentPage,
        pageSize,
        setPageSize,
        totalPages,
        paginatedItems,
        handleSelectProduct,
        handleQtyChange,
        handleAddItem,
        handleRemoveItem
    } = useItemRow({ rawPoItems, products, isCustomer });

    // 3. Hook Calculation Summary
    const { subtotal, taxAmount, grandTotal } = useSummary({ items, ppnPercent });

    // 4. Hook API Actions
    const {
        actionLoading,
        handleSubmit,
        handleCancelPO,
        handleUpdateStatus
    } = useActions({ poId, currentUser, onSuccess });

    // Cek apakah form masih diizinkan diedit oleh Customer
    const isEditableByCustomer = isCustomer && (!poId || poStatus === 'Draft' || poStatus === 'Waiting for Confirmation');

    // Handler Form Submit wrapper
    const onSubmitForm = (e) => {
        handleSubmit(e, {
            deliveryAddress,
            description,
            subtotal,
            taxAmount,
            grandTotal,
            items,
            customerId
        });
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
            <div style={{
                backgroundColor: '#fff', padding: '24px', borderRadius: '8px', width: '1000px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto'
            }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {poId ? `Detail Purchase Order: ${poCode}` : 'Create New Purchase Order (PO)'}
                    {poId && poStatus && (
                        <span style={getStatusStyle(poStatus)}>
                            {poStatus}
                        </span>
                    )}
                </h2>
                {error && <p style={{ color: 'red' }}>{error}</p>}

                <form onSubmit={onSubmitForm}>
                    <FormHeader
                        userRole={userRole}
                        poStatus={poStatus}
                        rejectionReason={rejectionReason}
                        deliveryAddress={deliveryAddress}
                        description={description}
                        setDescription={setDescription}
                    />

                    <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #dee2e6' }} />

                    <h3 style={{ marginBottom: '12px' }}>Product List</h3>

                    <div style={{ borderRadius: '8px', border: '1px solid #dee2e6', marginBottom: '16px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', tableLayout: 'fixed' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6', textAlign: 'left' }}>
                                    <th style={{ padding: '12px 16px', width: userRole !== 'CUSTOMER' ? '50%' : '36%' }}>Product</th>
                                    {userRole === 'CUSTOMER' && (
                                        <th style={{ padding: '12px 16px', width: '14%', textAlign: 'right' }}>Unit Price</th>
                                    )}
                                    <th style={{ padding: '12px 16px', width: userRole !== 'CUSTOMER' ? '20%' : '13%', textAlign: 'right' }}>Qty</th>
                                    <th style={{ padding: '12px 16px', width: userRole !== 'CUSTOMER' ? '20%' : '11%' }}>Unit</th>
                                    {userRole === 'CUSTOMER' && (
                                        <th style={{ padding: '12px 16px', width: '18%', textAlign: 'right' }}>Total Price</th>
                                    )}
                                    <th style={{ padding: '12px 16px', width: userRole !== 'CUSTOMER' ? '10%' : '8%', textAlign: 'center' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedItems.map((item, localIndex) => {
                                    const actualIndex = (currentPage - 1) * pageSize + localIndex;
                                    return (
                                        <ItemRow
                                            key={item.po_detail_id || item.id_product || actualIndex}
                                            index={actualIndex}
                                            item={item}
                                            searchTerm={searchTerm[actualIndex]}
                                            openDropdown={openDropdown}
                                            products={products}
                                            userRole={userRole}
                                            isReadOnly={!isEditableByCustomer}
                                            onSearchChange={(i, val) => {
                                                setSearchTerm({ ...searchTerm, [i]: val });
                                                setOpenDropdown(i);
                                            }}
                                            onFocusDropdown={(i) => setOpenDropdown(i)}
                                            onCloseDropdown={() => setOpenDropdown(null)}
                                            onSelectProduct={handleSelectProduct}
                                            onQtyChange={handleQtyChange}
                                            onRemoveItem={handleRemoveItem}
                                            isMultipleItems={items.length > 1}
                                        />
                                    );
                                })}
                            </tbody>
                        </table>

                        <PaginationControl
                            pagination={{
                                currentPage,
                                totalPages,
                                totalItems: items.length,
                                limit: pageSize
                            }}
                            onPageChange={(p) => setCurrentPage(p)}
                            onLimitChange={(l) => { setPageSize(l); setCurrentPage(1); }}
                        />
                    </div>

                    {isEditableByCustomer && (
                        <button
                            type="button"
                            onClick={handleAddItem}
                            style={{ marginBottom: '20px', padding: '8px 16px', backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
                        >
                            + Add Product Row
                        </button>
                    )}

                    <Summary
                        subtotal={subtotal}
                        ppnPercent={ppnPercent}
                        taxAmount={taxAmount}
                        grandTotal={grandTotal}
                        userRole={userRole}
                    />

                    <Actions
                        poId={poId}
                        userRole={userRole}
                        poStatus={poStatus}
                        loading={actionLoading}
                        onClose={onClose}
                        onCancel={handleCancelPO}
                        onUpdateStatus={handleUpdateStatus}
                    />
                </form>
            </div>
        </div>
    );
};

export default DetailModal;
