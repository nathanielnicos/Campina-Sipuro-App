import React, { useState, useEffect, useCallback } from 'react';
import { getStatusStyle } from '../../utils/statusHelper';
import { calculateUnitPrice } from '../../utils/priceCalculator';
import {
    fetchProducts,
    fetchCustomerDetail,
    fetchCompanyProfile,
    fetchPODetail,
    savePO,
    cancelPOApi,
    updatePOStatusApi
} from '../../services/poApi';
import ItemRow from './ItemRow';
import POSummary from './POSummary';
import POActions from './POActions';

const initialItemState = {
    id_product: '',
    product_code: '',
    product_name: '',
    qty: 1,
    base_price: 0,
    unit_price: 0,
    base_uom: '',
    selected_uom: '',
    pcs_per_ctn: 1,
    ctn_per_plt: 1,
    total_price: 0
};

const POCreateModal = ({ poId, customerId, userRole, onClose, onSuccess }) => {
    const [poStatus, setPoStatus] = useState('');
    const [products, setProducts] = useState([]);
    const [requestedDeliveryDate, setRequestedDeliveryDate] = useState('');
    const [deliveryAddress, setDeliveryAddress] = useState('');
    const [description, setDescription] = useState('');
    const [items, setItems] = useState([{ ...initialItemState }]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState({});
    const [openDropdown, setOpenDropdown] = useState(null);
    const [ppnPercent, setPpnPercent] = useState(null);

    const loadPODetailData = useCallback(async () => {
        if (!poId) return;
        try {
            const poRes = await fetchPODetail(poId);
            if (poRes.success && poRes.data) {
                const poHeader = poRes.data.header || {};
                const poItems = poRes.data.items || [];

                setPoStatus(poHeader.status || '');
                if (poHeader.requested_delivery_date) {
                    const d = new Date(poHeader.requested_delivery_date);
                    setRequestedDeliveryDate(d.toISOString().split('T')[0]);
                }
                setDeliveryAddress(poHeader.delivery_address || '');
                setDescription(poHeader.description || '');

                if (poItems.length > 0) {
                    const mappedItems = poItems.map(item => ({
                        po_detail_id: item.po_detail_id || item.id,
                        id_product: item.id_product || item.product_id,
                        product_code: item.product_code || item.code || '',
                        product_name: item.product_name || item.name || '',
                        qty: item.qty || 1,
                        base_price: parseFloat(item.base_price) || 0,
                        unit_price: parseFloat(item.unit_price || item.base_price) || 0,
                        base_uom: item.base_uom || item.uom || 'PCS',
                        selected_uom: item.uom || item.base_uom || 'PCS',
                        pcs_per_ctn: item.pcs_per_ctn || 1,
                        ctn_per_plt: item.ctn_per_plt || 1,
                        total_price: parseFloat(item.total_price) || 0
                    }));
                    setItems(mappedItems);

                    const initialSearch = {};
                    mappedItems.forEach((itm, idx) => {
                        if (itm.product_code || itm.product_name) {
                            initialSearch[idx] = `${itm.product_code} - ${itm.product_name}`;
                        }
                    });
                    setSearchTerm(initialSearch);
                }
            } else {
                setError(poRes.message || 'Gagal memuat detail PO.');
            }
        } catch (err) {
            console.error('Error fetching PO detail:', err);
            setError('Gagal memuat detail PO dari server.');
        }
    }, [poId]);

    useEffect(() => {
        const initData = async () => {
            try {
                const prodRes = await fetchProducts();
                if (prodRes.success) setProducts(prodRes.data);
                else setError('Gagal memuat katalog produk.');

                if (customerId) {
                    const custRes = await fetchCustomerDetail(customerId);
                    if (custRes.success && custRes.data) {
                        setDeliveryAddress(custRes.data.delivery_address || '');
                    }
                }

                const profileRes = await fetchCompanyProfile();
                if (profileRes.success && profileRes.data?.ppn_percent !== undefined) {
                    setPpnPercent(profileRes.data.ppn_percent);
                } else {
                    setError(profileRes.message || 'Gagal memuat tarif PPN.');
                }

                if (poId) {
                    await loadPODetailData();
                }
            } catch (err) {
                console.error('Error fetching data:', err);
                setError('Gagal terhubung ke server.');
            }
        };

        initData();
    }, [customerId, poId, loadPODetailData]);

    const handleSelectProduct = (index, prod) => {
        const basePrice = parseFloat(prod.base_price) || 0;
        const currentQty = items[index]?.qty || 1;
        const baseUom = prod.base_uom || 'PCS';

        const updatedItems = [...items];
        updatedItems[index] = {
            ...updatedItems[index],
            id_product: prod.id_product,
            product_code: prod.product_code,
            product_name: prod.product_name,
            base_price: basePrice,
            unit_price: basePrice,
            base_uom: baseUom,
            selected_uom: baseUom,
            pcs_per_ctn: prod.pcs_per_ctn || 1,
            ctn_per_plt: prod.ctn_per_plt || 1,
            total_price: basePrice * currentQty
        };

        setItems(updatedItems);
        setSearchTerm({ ...searchTerm, [index]: `${prod.product_code} - ${prod.product_name}` });
        setOpenDropdown(null);
    };

    const handleQtyChange = (index, rawValue) => {
        const cleanNumber = rawValue.replace(/\D/g, '');
        const qty = parseInt(cleanNumber, 10) || 0;

        const updatedItems = [...items];
        const item = updatedItems[index];
        item.qty = qty;
        item.total_price = (item.unit_price || 0) * qty;

        setItems(updatedItems);
    };

    const handleUomChange = (index, uomVal) => {
        const updatedItems = [...items];
        const item = updatedItems[index];
        item.selected_uom = uomVal;

        const newUnitPrice = calculateUnitPrice(
            item.base_price,
            item.base_uom,
            uomVal,
            item.pcs_per_ctn,
            item.ctn_per_plt
        );

        item.unit_price = newUnitPrice;
        item.total_price = newUnitPrice * item.qty;

        setItems(updatedItems);
    };

    const handleAddItem = () => {
        setItems([...items, { ...initialItemState }]);
    };

    const handleRemoveItem = (index) => {
        if (items.length === 1) return;
        const updatedItems = items.filter((_, i) => i !== index);
        const newSearchTerm = { ...searchTerm };
        delete newSearchTerm[index];

        setSearchTerm(newSearchTerm);
        setItems(updatedItems);
    };

    const subtotal = items.reduce((sum, item) => sum + (item.total_price || 0), 0);
    const taxAmount = subtotal * (ppnPercent / 100);
    const grandTotal = subtotal + taxAmount;

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!requestedDeliveryDate) {
            alert('Tanggal pengiriman wajib diisi!');
            return;
        }

        const invalidItem = items.find((i) => !i.id_product || i.qty <= 0);
        if (invalidItem) {
            alert('Harap pilih produk dan pastikan Qty lebih dari 0 pada seluruh baris.');
            return;
        }

        const payload = {
            customer_id: customerId,
            requested_delivery_date: requestedDeliveryDate,
            delivery_address: deliveryAddress,
            description,
            subtotal,
            tax_amount: taxAmount,
            grand_total: grandTotal,
            items: items.map(item => ({
                po_detail_id: item.po_detail_id || undefined,
                id_product: item.id_product,
                qty: item.qty,
                selected_uom: item.selected_uom,
                unit_price: item.unit_price,
                total_price: item.total_price
            }))
        };

        try {
            setLoading(true);
            const result = await savePO(poId, payload);
            if (result.success) {
                alert(poId ? 'PO Berhasil diperbarui!' : 'PO Berhasil dibuat!');
                if (onSuccess) onSuccess();
            } else {
                alert('Gagal menyimpan PO: ' + (result.message || 'Terjadi kesalahan.'));
            }
        } catch (err) {
            console.error('Error submitting PO:', err);
            alert('Terjadi kesalahan koneksi saat menyimpan PO.');
        } finally {
            setLoading(false);
        }
    };

    const handleCancelPO = async () => {
        if (!window.confirm('Apakah Anda yakin ingin membatalkan PO ini?')) return;

        try {
            setLoading(true);
            const result = await cancelPOApi(poId);
            if (result.success) {
                alert('PO berhasil dibatalkan!');
                if (onSuccess) onSuccess();
            } else {
                alert('Gagal membatalkan PO: ' + result.message);
            }
        } catch (err) {
            console.error('Error canceling PO:', err);
            alert('Terjadi kesalahan saat membatalkan PO.');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (newStatus) => {
        let notes = '';
        if (newStatus === 'Rejected') {
            const inputNotes = prompt('Masukkan alasan penolakan PO (Wajib diisi):');
            if (inputNotes === null) return;
            if (!inputNotes.trim()) {
                alert('Alasan penolakan wajib diisi!');
                return;
            }
            notes = inputNotes;
        }

        try {
            const result = await updatePOStatusApi(poId, newStatus, notes, customerId);
            if (result.success) {
                if (newStatus === 'Rejected') alert('PO berhasil ditolak!');
                else if (newStatus === 'Waiting Batch Assignment') alert('PO berhasil disetujui!');
                else alert(`Status PO berhasil diperbarui menjadi ${newStatus}!`);

                if (onSuccess) onSuccess();
            } else {
                alert(result.message || 'Gagal mengubah status PO.');
            }
        } catch (err) {
            console.error('Error updating status:', err);
            alert('Terjadi kesalahan koneksi server.');
        }
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
                    {poId ? `Detail Purchase Order #${poId}` : 'Buat Purchase Order (PO) Baru'}
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
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Tanggal Pengiriman Diminta *</label>
                            <input
                                type="date"
                                value={requestedDeliveryDate}
                                onChange={(e) => setRequestedDeliveryDate(e.target.value)}
                                required
                                disabled={userRole === 'PPIC'}
                                style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Alamat Pengiriman</label>
                            <input
                                type="text"
                                placeholder="Alamat pengiriman..."
                                value={deliveryAddress}
                                onChange={(e) => setDeliveryAddress(e.target.value)}
                                disabled={userRole === 'PPIC'}
                                style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Catatan</label>
                        <textarea
                            rows="2"
                            placeholder="Catatan tambahan untuk pesanan..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            disabled={userRole === 'PPIC'}
                            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                        />
                    </div>

                    <hr style={{ margin: '20px 0' }} />

                    <h3>Daftar Produk</h3>
                    <table border="1" cellPadding="8" cellSpacing="0" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f2f2f2' }}>
                                <th style={{ width: '35%' }}>Produk</th>
                                <th style={{ width: '15%' }}>Harga Satuan</th>
                                <th style={{ width: '10%' }}>Qty</th>
                                <th style={{ width: '12%' }}>UOM</th>
                                <th style={{ width: '18%' }}>Total Harga</th>
                                <th style={{ width: '10%' }}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, index) => (
                                <ItemRow
                                    key={index}
                                    index={index}
                                    item={item}
                                    searchTerm={searchTerm[index]}
                                    openDropdown={openDropdown}
                                    products={products}
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
                            ))}
                        </tbody>
                    </table>

                    {userRole !== 'PPIC' && (
                        <button
                            type="button"
                            onClick={handleAddItem}
                            style={{ marginBottom: '20px', padding: '6px 12px', backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        >
                            + Tambah Baris Produk
                        </button>
                    )}

                    <POSummary
                        subtotal={subtotal}
                        ppnPercent={ppnPercent}
                        taxAmount={taxAmount}
                        grandTotal={grandTotal}
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
