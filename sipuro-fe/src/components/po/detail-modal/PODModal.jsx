import { getStatusStyle } from '../../../utils/statusHelper';
import PODHeader from './PODHeader';
import PODItemsTable from './PODItemsTable';
import PODSummary from './PODSummary';
import PODActions from './PODActions';
import PODPriceNotice from './PODPriceNotice';
import { PO_STATUS } from '../../../constants/po';

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
    } = usePODRow({ rawPoItems, products, isCustomer, poStatus });

    // 3. Hook Calculation Summary
    const { subtotal, taxAmount, grandTotal, isTooLarge } = usePODSummary({ items, ppnPercent });

    // 4. Hook API Actions
    const {
        actionLoading,
        handleSubmit,
        handleCancelPO,
        handleUpdateStatus
    } = usePODActions({ poId, onSuccess });

    // Cek apakah form masih diizinkan diedit oleh Customer
    const isEditableByCustomer = isCustomer && (!poId || poStatus === PO_STATUS.DRAFT || poStatus === PO_STATUS.WAITING);

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
            items,
            poStatus,
            isTooLarge
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

                    {isCustomer && <PODPriceNotice items={items} />}

                    <PODItemsTable
                        items={items}
                        paginatedItems={paginatedItems}
                        currentPage={currentPage}
                        pageSize={pageSize}
                        totalPages={totalPages}
                        searchTerm={searchTerm}
                        openDropdown={openDropdown}
                        products={products}
                        userRole={userRole}
                        isEditable={isEditableByCustomer}
                        onSearchChange={(rowId, val) => {
                            setSearchTerm((prev) => ({ ...prev, [rowId]: val }));
                            setOpenDropdown(rowId);
                        }}
                        onFocusDropdown={(rowId) => setOpenDropdown(rowId)}
                        onCloseDropdown={() => setOpenDropdown(null)}
                        onSelectProduct={handleSelectProduct}
                        onQtyChange={handleQtyChange}
                        onRemoveItem={handleRemoveItem}
                        onAddItem={handleAddItem}
                        onPageChange={(p) => setCurrentPage(p)}
                        onLimitChange={(l) => { setPageSize(l); setCurrentPage(1); }}
                    />

                    <PODSummary
                        subtotal={subtotal}
                        ppnPercent={ppnPercent}
                        taxAmount={taxAmount}
                        grandTotal={grandTotal}
                        userRole={userRole}
                        isTooLarge={isTooLarge}
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
