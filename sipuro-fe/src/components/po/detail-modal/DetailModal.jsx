import { getStatusStyle } from '../../../utils/statusHelper';
import FormHeader from './FormHeader';
import ItemRow from './ItemRow';
import Summary from './Summary';
import Actions from './Actions';
import PaginationControl from '../../common/PaginationControl';

// Import ke-4 Custom Hook baru
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
        requestedDeliveryDate,
        setRequestedDeliveryDate,
        deliveryAddress,
        description,
        setDescription,
        rejectionReason,
        ppnPercent,
        rawPoItems,
        loading: headerLoading,
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

    // Kombinasi status loading
    const isLoading = headerLoading || actionLoading;

    // Handler Form Submit wrapper untuk menyatukan data dari berbagai hook
    const onSubmitForm = (e) => {
        handleSubmit(e, {
            requestedDeliveryDate,
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
                backgroundColor: '#fff', padding: '24px', borderRadius: '8px', width: '900px', maxHeight: '90vh', overflowY: 'auto'
            }}>
                <h2>
                    {poId ? `Detail Purchase Order: ${poCode}` : 'Create New Purchase Order (PO)'}
                    {poId && poStatus && (
                        <span style={{
                            padding: '4px 10px', borderRadius: '12px', fontSize: '13px', fontWeight: 'bold',
                            marginLeft: '10px', display: 'inline-block', ...getStatusStyle(poStatus)
                        }}>
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
                        requestedDeliveryDate={requestedDeliveryDate}
                        setRequestedDeliveryDate={setRequestedDeliveryDate}
                        deliveryAddress={deliveryAddress}
                        description={description}
                        setDescription={setDescription}
                    />

                    <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #dee2e6' }} />

                    <h3 style={{ marginBottom: '12px' }}>Product List</h3>

                    <div style={{ borderRadius: '8px', border: '1px solid #dee2e6', marginBottom: '16px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6', textAlign: 'left' }}>
                                    <th style={{ padding: '12px 16px', width: userRole !== 'CUSTOMER' ? '50%' : '35%' }}>Product</th>
                                    {userRole === 'CUSTOMER' && (
                                        <th style={{ padding: '12px 16px', width: '15%', textAlign: 'right' }}>Unit Price</th>
                                    )}
                                    <th style={{ padding: '12px 16px', width: userRole !== 'CUSTOMER' ? '20%' : '12%', textAlign: 'center' }}>Qty</th>
                                    <th style={{ padding: '12px 16px', width: userRole !== 'CUSTOMER' ? '20%' : '12%' }}>Unit</th>
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
                                            isReadOnly={userRole !== 'CUSTOMER'}
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

                    {userRole === 'CUSTOMER' && (
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
                        loading={isLoading}
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
