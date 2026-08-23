import React from 'react';
import { formatCurrency } from '../../utils/formatters';

const ItemRow = ({
    index,
    item,
    searchTerm,
    openDropdown,
    products,
    isReadOnly,
    onSearchChange,
    onFocusDropdown,
    onSelectProduct,
    onQtyChange,
    onUomChange,
    onRemoveItem,
    isMultipleItems
}) => {
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

    return (
        <tr>
            <td style={{ position: 'relative' }}>
                <input
                    type="text"
                    placeholder="Cari Kode / Nama..."
                    value={searchTerm !== undefined ? searchTerm : ''}
                    onFocus={() => onFocusDropdown(index)}
                    onChange={(e) => onSearchChange(index, e.target.value)}
                    disabled={isReadOnly}
                    style={{ width: '100%', padding: '6px', boxSizing: 'border-box' }}
                />

                {!isReadOnly && openDropdown === index && (
                    <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0,
                        maxHeight: '180px', overflowY: 'auto', backgroundColor: '#fff',
                        border: '1px solid #ccc', borderRadius: '4px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', zIndex: 1000
                    }}>
                        {products
                            .filter(p => {
                                const kw = (searchTerm || '').toLowerCase();
                                return p.product_code.toLowerCase().includes(kw) || p.product_name.toLowerCase().includes(kw);
                            })
                            .map(p => (
                                <div
                                    key={p.id_product}
                                    onClick={() => onSelectProduct(index, p)}
                                    onMouseDown={(e) => e.preventDefault()}
                                    style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #eee', fontSize: '13px' }}
                                >
                                    <strong>{p.product_code}</strong> - {p.product_name}
                                </div>
                            ))}
                    </div>
                )}
            </td>
            <td style={{ textAlign: 'right' }}>{formatCurrency(item.unit_price)}</td>
            <td>
                <input
                    type="text"
                    value={item.qty || ''}
                    onChange={(e) => onQtyChange(index, e.target.value)}
                    disabled={isReadOnly}
                    style={{ width: '100%', padding: '6px', boxSizing: 'border-box', textAlign: 'center' }}
                    placeholder="0"
                />
            </td>
            <td>
                {!item.id_product ? (
                    <span style={{ color: '#999', fontSize: '12px', display: 'block', textAlign: 'center' }}>-</span>
                ) : (
                    <select
                        value={item.selected_uom}
                        onChange={(e) => onUomChange(index, e.target.value)}
                        disabled={isReadOnly}
                        style={{ width: '100%', padding: '6px 2px', boxSizing: 'border-box' }}
                    >
                        {item.base_uom && <option value={item.base_uom}>{item.base_uom}</option>}
                        {item.base_uom !== 'CTN' && Number(item.pcs_per_ctn) > 0 && <option value="CTN">CTN</option>}
                        {item.base_uom !== 'PLT' && Number(item.ctn_per_plt) > 0 && <option value="PLT">PLT</option>}
                    </select>
                )}
            </td>
            <td style={{ textAlign: 'right' }}>{formatCurrency(item.total_price)}</td>
            <td style={{ textAlign: 'center' }}>
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                    {!isReadOnly && isMultipleItems ? (
                        <button
                            type="button"
                            onClick={() => onRemoveItem(index)}
                            style={{ ...actionButtonStyle, backgroundColor: '#dc3545', color: '#fff' }}
                        >
                            Hapus
                        </button>
                    ) : (
                        <span style={{ color: '#aaa', fontSize: '12px' }}>-</span>
                    )}
                </div>
            </td>
        </tr>
    );
};

export default ItemRow;
