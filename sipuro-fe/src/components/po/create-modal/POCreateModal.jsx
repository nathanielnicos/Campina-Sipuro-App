import React from 'react';
import { getStatusStyle } from '../../../utils/statusHelper';
import { usePOModal } from './usePOModal';
import POFormHeader from './POFormHeader';
import ItemRow from './ItemRow';
import POSummary from './POSummary';
import POActions from './POActions';
import PaginationControl from '../../common/PaginationControl';

const POCreateModal = ({ poId, customerId, userRole, onClose, onSuccess }) => {
    const {
        poCode,
        poStatus,
        products,
        requestedDeliveryDate,
        setRequestedDeliveryDate,
        deliveryAddress,
        setDeliveryAddress,
        description,
        setDescription,
        rejectionReason,
        items,
        loading,
        error,
        searchTerm,
        setSearchTerm,
        openDropdown,
        setOpenDropdown,
        ppnPercent,
        currentPage,
        setCurrentPage,
        pageSize,
        setPageSize,
        totalPages,
        paginatedItems,
        subtotal,
        taxAmount,
        grandTotal,
        handleSelectProduct,
        handleQtyChange,
        handleUomChange,
        handleAddItem,
        handleRemoveItem,
        handleSubmit,
        handleCancelPO,
        handleUpdateStatus
    } = usePOModal({ poId, customerId, userRole, onSuccess });

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
            <div style={{
                backgroundColor: '#fff', padding: '24px', borderRadius: '8px', width: '900px', maxHeight: '90vh', overflowY: 'auto'
            }}>
                <h2>
                    {/* Menggunakan kode PO alih-alih poId */}
                    {poId ? `Detail Purchase Order: ${poCode}` : 'Buat Purchase Order (PO) Baru'}
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

                <form onSubmit={handleSubmit}>
                    <POFormHeader
                        userRole={userRole}
                        poStatus={poStatus}
                        rejectionReason={rejectionReason}
                        requestedDeliveryDate={requestedDeliveryDate}
                        setRequestedDeliveryDate={setRequestedDeliveryDate}
                        deliveryAddress={deliveryAddress}
                        setDeliveryAddress={setDeliveryAddress}
                        description={description}
                        setDescription={setDescription}
                    />

                    <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #dee2e6' }} />

                    <h3 style={{ marginBottom: '12px' }}>Daftar Produk</h3>

                    <div style={{ borderRadius: '8px', border: '1px solid #dee2e6', marginBottom: '16px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6', textAlign: 'left' }}>
                                    <th style={{ padding: '12px 16px', width: userRole === 'PPIC' ? '50%' : '35%' }}>Produk</th>
                                    {userRole !== 'PPIC' && (
                                        <th style={{ padding: '12px 16px', width: '15%', textAlign: 'right' }}>Harga Satuan</th>
                                    )}
                                    <th style={{ padding: '12px 16px', width: userRole === 'PPIC' ? '20%' : '12%', textAlign: 'center' }}>Qty</th>
                                    <th style={{ padding: '12px 16px', width: userRole === 'PPIC' ? '20%' : '12%' }}>UOM</th>
                                    {userRole !== 'PPIC' && (
                                        <th style={{ padding: '12px 16px', width: '18%', textAlign: 'right' }}>Total Harga</th>
                                    )}
                                    <th style={{ padding: '12px 16px', width: userRole === 'PPIC' ? '10%' : '8%', textAlign: 'center' }}>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedItems.map((item, localIndex) => {
                                    const actualIndex = (currentPage - 1) * pageSize + localIndex;
                                    return (
                                        <ItemRow
                                            key={actualIndex}
                                            index={actualIndex}
                                            item={item}
                                            searchTerm={searchTerm[actualIndex]}
                                            openDropdown={openDropdown}
                                            products={products}
                                            userRole={userRole}
                                            isReadOnly={userRole === 'PPIC'}
                                            onSearchChange={(i, val) => {
                                                setSearchTerm({ ...searchTerm, [i]: val });
                                                setOpenDropdown(i);
                                            }}
                                            onFocusDropdown={(i) => setOpenDropdown(i)}
                                            onSelectProduct={handleSelectProduct}
                                            onQtyChange={handleQtyChange}
                                            onUomChange={handleUomChange}
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

                    {userRole !== 'PPIC' && (
                        <button
                            type="button"
                            onClick={handleAddItem}
                            style={{ marginBottom: '20px', padding: '8px 16px', backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
                        >
                            + Tambah Baris Produk
                        </button>
                    )}

                    <POSummary
                        subtotal={subtotal}
                        ppnPercent={ppnPercent}
                        taxAmount={taxAmount}
                        grandTotal={grandTotal}
                        userRole={userRole}
                    />

                    <POActions
                        poId={poId}
                        userRole={userRole}
                        poStatus={poStatus}
                        loading={loading}
                        onClose={onClose}
                        onCancel={handleCancelPO}
                        onUpdateStatus={handleUpdateStatus}
                    />
                </form>
            </div>
        </div>
    );
};

export default POCreateModal;
