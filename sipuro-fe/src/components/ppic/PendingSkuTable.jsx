import React from 'react';
import { formatQty } from '../../utils/formatters';
import PaginationControl from '../common/PaginationControl';

const PendingSkuTable = ({
    summaryList = [],
    onOpenModal,
    pagination = {},
    onPageChange,
    onLimitChange,
    searchProduct,
    setSearchProduct,
    searchPo,
    setSearchPo,
    onResetFilters
}) => {
    const handleProductChange = (e) => {
        setSearchProduct(e.target.value);
        if (onPageChange) onPageChange(1);
    };

    const handlePoChange = (e) => {
        setSearchPo(e.target.value);
        if (onPageChange) onPageChange(1);
    };

    const isFilterActive = Boolean(searchProduct || searchPo);
    const isPoFilterActive = Boolean(searchPo && searchPo.trim() !== '');

    return (
        <div>
            {/* Filter Bar Tab 1 */}
            <div style={{
                backgroundColor: '#fff',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid #dee2e6',
                marginBottom: '20px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px',
                alignItems: 'end'
            }}>
                <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Cari Produk (Kode / Nama)</label>
                    <input
                        type="text"
                        placeholder="Contoh: FG-CN-00060"
                        value={searchProduct}
                        onChange={handleProductChange}
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da', boxSizing: 'border-box' }}
                    />
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Cari No PO</label>
                    <input
                        type="text"
                        placeholder="Contoh: PO-20260824-895"
                        value={searchPo}
                        onChange={handlePoChange}
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da', boxSizing: 'border-box' }}
                    />
                </div>
                <div>
                    <button
                        onClick={onResetFilters}
                        disabled={!isFilterActive}
                        style={{
                            width: '100%',
                            padding: '8px 12px',
                            backgroundColor: isFilterActive ? '#dc3545' : '#e9ecef',
                            color: isFilterActive ? '#fff' : '#adb5bd',
                            border: isFilterActive ? '1px solid #dc3545' : '1px solid #ced4da',
                            borderRadius: '4px',
                            cursor: isFilterActive ? 'pointer' : 'not-allowed',
                            fontWeight: 'bold',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        Reset Filter
                    </button>
                </div>
            </div>

            {/* Tabel Data */}
            <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #dee2e6', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', tableLayout: 'auto' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6', textAlign: 'left' }}>
                                <th style={{ padding: '12px 10px', whiteSpace: 'nowrap' }}>Kode Produk</th>
                                <th style={{ padding: '12px 10px' }}>Nama Produk</th>
                                <th style={{ padding: '12px 10px', textAlign: 'right', wordBreak: 'break-word' }}>Total Qty Dibutuhkan (PCS)</th>
                                <th style={{ padding: '12px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>Jumlah PO</th>
                                <th style={{ padding: '12px 10px', whiteSpace: 'nowrap' }}>No PO</th>
                                <th style={{ padding: '12px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>Qty PO (PCS)</th>
                                <th style={{ padding: '12px 10px', textAlign: 'center', whiteSpace: 'nowrap', width: '140px' }}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {summaryList.length === 0 ? (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: '#6c757d' }}>
                                        Tidak ada kebutuhan SKU yang perlu dialokasikan saat ini.
                                    </td>
                                </tr>
                            ) : (
                                summaryList.map((row) => {
                                    const poItems = row.po_numbers
                                        ? row.po_numbers.split('\n').filter(Boolean)
                                        : [];

                                    return (
                                        <tr key={row.id_product} style={{ borderBottom: '1px solid #dee2e6' }}>
                                            <td style={{ padding: '12px 10px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                                                <strong>{row.product_code}</strong>
                                            </td>
                                            <td style={{ padding: '12px 10px', verticalAlign: 'middle', wordBreak: 'break-word' }}>
                                                {row.product_name}
                                            </td>
                                            <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 'bold', verticalAlign: 'middle' }}>
                                                {formatQty(row.total_qty_needed)}
                                            </td>
                                            <td style={{ padding: '12px 10px', textAlign: 'center', verticalAlign: 'middle' }}>
                                                {formatQty(row.total_po_count)}
                                            </td>

                                            <td style={{ padding: '12px 10px', verticalAlign: 'middle', whiteSpace: 'nowrap', lineHeight: '1.6' }}>
                                                {poItems.length > 0 ? (
                                                    poItems.map((item, idx) => {
                                                        const poNumber = item.split(' (')[0];
                                                        return <div key={idx} style={{ fontWeight: '500' }}>{poNumber}</div>;
                                                    })
                                                ) : (
                                                    '-'
                                                )}
                                            </td>

                                            <td style={{ padding: '12px 10px', textAlign: 'right', verticalAlign: 'middle', whiteSpace: 'nowrap', lineHeight: '1.6' }}>
                                                {poItems.length > 0 ? (
                                                    poItems.map((item, idx) => {
                                                        const match = item.match(/\((.*?)\)/);
                                                        const rawContent = match ? match[1] : '';
                                                        const numericPart = rawContent.split(' ')[0];
                                                        const formattedQty = numericPart ? formatQty(numericPart) : '-';

                                                        return (
                                                            <div key={idx}>
                                                                {formattedQty}
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    '-'
                                                )}
                                            </td>

                                            <td style={{ padding: '12px 10px', textAlign: 'center', verticalAlign: 'middle' }}>
                                                <button
                                                    onClick={() => onOpenModal(row)}
                                                    disabled={isPoFilterActive}
                                                    title={isPoFilterActive ? "Reset filter No PO untuk alokasi batch" : ""}
                                                    style={{
                                                        backgroundColor: isPoFilterActive ? '#6c757d' : '#0d6efd',
                                                        color: '#fff',
                                                        border: 'none',
                                                        padding: '6px 12px',
                                                        borderRadius: '4px',
                                                        cursor: isPoFilterActive ? 'not-allowed' : 'pointer',
                                                        fontWeight: '600',
                                                        fontSize: '12px',
                                                        whiteSpace: 'nowrap',
                                                        display: 'inline-block',
                                                        opacity: isPoFilterActive ? 0.65 : 1
                                                    }}
                                                >
                                                    + Alokasikan Batch
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                <PaginationControl
                    pagination={pagination}
                    onPageChange={onPageChange}
                    onLimitChange={onLimitChange}
                />
            </div>
        </div>
    );
};

export default PendingSkuTable;
