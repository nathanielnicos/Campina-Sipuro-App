import { useEffect, useRef } from 'react';
import { formatCurrency, formatQty } from '../../../utils/formatters';

const ItemRow = ({
    index,
    item,
    searchTerm,
    openDropdown,
    products,
    userRole,
    isReadOnly,
    onSearchChange,
    onFocusDropdown,
    onSelectProduct,
    onQtyChange,
    onRemoveItem,
    isMultipleItems,
    onCloseDropdown
}) => {
    const isCustomer = userRole === 'CUSTOMER';
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                if (openDropdown === index && onCloseDropdown) {
                    onCloseDropdown();
                }
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [openDropdown, index, onCloseDropdown]);

    const actionButtonStyle = {
        padding: '6px 12px',
        fontSize: '12px',
        height: '32px',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        boxSizing: 'border-box',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        whiteSpace: 'nowrap'
    };

    const inputStyle = {
        width: '100%',
        padding: '6px 10px',
        boxSizing: 'border-box',
        borderRadius: '4px',
        border: '1px solid #ced4da',
        fontSize: '14px',
        backgroundColor: isReadOnly ? '#e9ecef' : '#fff'
    };

    const filteredProducts = products.filter(p => {
        const kw = (searchTerm || '').toLowerCase();
        if (isCustomer) {
            return p.product_name.toLowerCase().includes(kw);
        }
        return p.product_code.toLowerCase().includes(kw) || p.product_name.toLowerCase().includes(kw);
    });

    const handleQtyInputChange = (e) => {
        const rawValue = e.target.value.replace(/\D/g, '');
        onQtyChange(index, rawValue);
    };

    return (
        <tr style={{ borderBottom: '1px solid #dee2e6' }}>
            <td ref={dropdownRef} style={{ padding: '12px 16px', position: 'relative' }}>
                <input
                    type="text"
                    placeholder={isCustomer ? "Search product name..." : "Search product code/name..."}
                    value={searchTerm !== undefined ? searchTerm : ''}
                    onFocus={() => onFocusDropdown(index)}
                    onClick={() => onFocusDropdown(index)}
                    onChange={(e) => onSearchChange(index, e.target.value)}
                    disabled={isReadOnly}
                    style={inputStyle}
                />

                {!isReadOnly && openDropdown === index && (
                    <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: '16px',
                        right: '16px',
                        maxHeight: '180px',
                        overflowY: 'auto',
                        backgroundColor: '#fff',
                        border: '1px solid #ced4da',
                        borderRadius: '4px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        zIndex: 9999
                    }}>
                        {filteredProducts.length === 0 ? (
                            <div style={{ padding: '8px 12px', color: '#6c757d', fontSize: '13px' }}>
                                No products found.
                            </div>
                        ) : (
                            filteredProducts.map(p => (
                                <div
                                    key={p.id_product}
                                    onClick={() => onSelectProduct(index, p)}
                                    onMouseDown={(e) => e.preventDefault()}
                                    style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f3f5', fontSize: '13px' }}
                                >
                                    {isCustomer ? (
                                        p.product_name
                                    ) : (
                                        <>
                                            <strong>{p.product_code}</strong> - {p.product_name}
                                        </>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}
            </td>

            {userRole === 'CUSTOMER' && (
                <td style={{ padding: '12px 16px', textAlign: 'right', verticalAlign: 'middle' }}>
                    {formatCurrency(item.unit_price)}
                </td>
            )}

            <td style={{ padding: '12px 10px' }}>
                <input
                    type="text"
                    value={item.qty ? formatQty(item.qty) : ''}
                    onChange={handleQtyInputChange}
                    disabled={isReadOnly}
                    style={{ ...inputStyle, textAlign: 'right' }}
                    placeholder="0"
                />
            </td>
            <td style={{ padding: '12px 16px' }}>
                {!item.id_product ? (
                    <span style={{ color: '#999', fontSize: '14px', display: 'block', textAlign: 'center' }}>-</span>
                ) : (
                    <select
                        value={item.selected_uom}
                        disabled
                        style={inputStyle}
                    >
                        {item.base_uom && <option value={item.base_uom}>{item.base_uom}</option>}
                        {item.base_uom !== 'CTN' && Number(item.pcs_per_ctn) > 0 && <option value="CTN">CTN</option>}
                        {item.base_uom !== 'PLT' && Number(item.ctn_per_plt) > 0 && <option value="PLT">PLT</option>}
                    </select>
                )}
            </td>

            {userRole === 'CUSTOMER' && (
                <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 'bold', verticalAlign: 'middle' }}>
                    {formatCurrency(item.total_price)}
                </td>
            )}

            <td style={{ padding: '12px 16px', textAlign: 'center', verticalAlign: 'middle' }}>
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                    {!isReadOnly && isMultipleItems ? (
                        <button
                            type="button"
                            onClick={() => onRemoveItem(index)}
                            style={{ ...actionButtonStyle, backgroundColor: '#dc3545', color: '#fff' }}
                        >
                            Delete
                        </button>
                    ) : (
                        <span style={{ color: '#aaa', fontSize: '14px' }}>-</span>
                    )}
                </div>
            </td>
        </tr>
    );
};

export default ItemRow;
