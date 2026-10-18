import { getStatusStyle } from '../../../utils/statusHelper';
import PODHeader from './PODHeader';
import PODRow from './PODRow';
import PODSummary from './PODSummary';
import PODActions from './PODActions';
import PaginationControl from '../../common/PaginationControl';

// Import ke-4 Custom Hook
import { usePODHeader } from '../../../hooks/po/detail-modal/usePODHeader';
import { usePODRow } from '../../../hooks/po/detail-modal/usePODRow';
import { usePODSummary } from '../../../hooks/po/detail-modal/usePODSummary';
import { usePODActions } from '../../../hooks/po/detail-modal/usePODActions';

const PODModal = ({ poId, currentUser, onClose, onSuccess }) => {
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
        isCustomer
    } = usePODHeader({ poId, currentUser });

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
    } = usePODRow({ rawPoItems, products, isCustomer });

    // 3. Hook Calculation Summary
    const { subtotal, taxAmount, grandTotal } = usePODSummary({ items, ppnPercent });

    // 4. Hook API Actions
    const {
        actionLoading,
        handleSubmit,
        handleCancelPO,
        handleUpdateStatus
    } = usePODActions({ poId, onSuccess });

    // Cek apakah form masih diizinkan diedit oleh Customer
    const isEditableByCustomer = isCustomer && (!poId || poStatus === 'Draft' || poStatus === 'Waiting for Confirmation');

    // Approve / Reject hanya untuk karyawan PPIC (STAFF / MANAGER), bukan SUPERADMIN
    const canReview = userRole !== 'CUSTOMER'
        && userRole !== 'SUPERADMIN'
        && String(currentUser?.department || '').trim().toUpperCase() === 'PPIC';

    // Tekan Enter di kolom isian tidak boleh mengirim form secara tidak sengaja.
    // Tombol Save / Submit tetap bekerja karena hanya event dari <input> yang diblokir.
    const handleFormKeyDown = (e) => {
        if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
            e.preventDefault();
        }
    };

    // Handler Form Submit wrapper
    const onSubmitForm = (e) => {
        handleSubmit(e, {
            deliveryAddress,
            description,
            subtotal,
            taxAmount,
            grandTotal,
            items,
            poStatus
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

                <form onSubmit={onSubmitForm} onKeyDown={handleFormKeyDown}>
                    <PODHeader
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
                                        <PODRow
                                            key={item.row_id}
                                            index={actualIndex}
                                            item={item}
                                            searchTerm={searchTerm[actualIndex]}
                                            openDropdown={openDropdown}
                                            products={products}
                                            takenProductIds={items
                                                .filter((_, i) => i !== actualIndex)
                                                .map((it) => String(it.id_product))
                                                .filter((id) => id !== '')}
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

                    <PODSummary
                        subtotal={subtotal}
                        ppnPercent={ppnPercent}
                        taxAmount={taxAmount}
                        grandTotal={grandTotal}
                        userRole={userRole}
                    />

                    <PODActions
                        poId={poId}
                        userRole={userRole}
                        canReview={canReview}
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

export default PODModal;
