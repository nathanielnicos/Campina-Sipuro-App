import PODRow from './PODRow';
import PaginationControl from '../../common/PaginationControl';

/**
 * Tabel daftar produk pada modal PO (header kolom, baris item, paginasi, dan tombol tambah baris).
 * Seluruh state dikelola oleh pemanggil (usePODRow); komponen ini hanya menampilkan.
 */
const PODItemsTable = ({
    items,
    paginatedItems,
    currentPage,
    pageSize,
    totalPages,
    searchTerm,
    openDropdown,
    products,
    userRole,
    isEditable,
    onSearchChange,
    onFocusDropdown,
    onCloseDropdown,
    onSelectProduct,
    onQtyChange,
    onRemoveItem,
    onAddItem,
    onPageChange,
    onLimitChange
}) => {
    const isCustomer = userRole === 'CUSTOMER';

    return (
        <>
            <div style={{ borderRadius: '8px', border: '1px solid #dee2e6', marginBottom: '16px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', tableLayout: 'fixed' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6', textAlign: 'left' }}>
                            <th style={{ padding: '12px 16px', width: !isCustomer ? '50%' : '36%' }}>Product</th>
                            {isCustomer && (
                                <th style={{ padding: '12px 16px', width: '14%', textAlign: 'right' }}>Unit Price</th>
                            )}
                            <th style={{ padding: '12px 16px', width: !isCustomer ? '20%' : '13%', textAlign: 'right' }}>Qty</th>
                            <th style={{ padding: '12px 16px', width: !isCustomer ? '20%' : '11%' }}>Unit</th>
                            {isCustomer && (
                                <th style={{ padding: '12px 16px', width: '18%', textAlign: 'right' }}>Total Price</th>
                            )}
                            <th style={{ padding: '12px 16px', width: !isCustomer ? '10%' : '8%', textAlign: 'center' }}>Action</th>
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
                                    searchTerm={searchTerm[item.row_id]}
                                    openDropdown={openDropdown}
                                    products={products}
                                    takenProductIds={items
                                        .filter((_, i) => i !== actualIndex)
                                        .map((it) => String(it.id_product))
                                        .filter((id) => id !== '')}
                                    userRole={userRole}
                                    isReadOnly={!isEditable}
                                    onSearchChange={onSearchChange}
                                    onFocusDropdown={onFocusDropdown}
                                    onCloseDropdown={onCloseDropdown}
                                    onSelectProduct={onSelectProduct}
                                    onQtyChange={onQtyChange}
                                    onRemoveItem={onRemoveItem}
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
                    onPageChange={onPageChange}
                    onLimitChange={onLimitChange}
                />
            </div>

            {isEditable && (
                <button
                    type="button"
                    onClick={onAddItem}
                    style={{ marginBottom: '20px', padding: '8px 16px', backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
                >
                    + Add Product Row
                </button>
            )}
        </>
    );
};

export default PODItemsTable;
