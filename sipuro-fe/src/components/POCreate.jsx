import React, { useState, useEffect } from 'react';
import { getStatusStyle } from '../utils/statusHelper';

const POCreate = ({ poId, customerId, userRole, onClose, onSuccess }) => {
    const [poStatus, setPoStatus] = useState('');
    const [products, setProducts] = useState([]);
    const [requestedDeliveryDate, setRequestedDeliveryDate] = useState('');
    const [deliveryAddress, setDeliveryAddress] = useState('');
    const [description, setDescription] = useState('');

    // Inisialisasi awal dengan 1 baris kosong
    const [items, setItems] = useState([
        {
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
        }
    ]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState({});
    const [openDropdown, setOpenDropdown] = useState(null);
    const [ppnPercent, setPpnPercent] = useState(null);

    // Fetch daftar produk & detail customer dari Backend
    useEffect(() => {
        const fetchData = async () => {
            try {
                // 1. Fetch Produk
                const resProducts = await fetch('http://localhost:5000/api/products');
                const resultProducts = await resProducts.json();
                if (resultProducts.success) {
                    setProducts(resultProducts.data);
                } else {
                    setError('Gagal memuat katalog produk.');
                }

                // 2. Fetch Detail Customer
                if (customerId) {
                    const resCustomer = await fetch(`http://localhost:5000/api/customers/${customerId}`);
                    const resultCustomer = await resCustomer.json();
                    if (resultCustomer.success && resultCustomer.data) {
                        setDeliveryAddress(resultCustomer.data.delivery_address || '');
                    }
                }

                // 3. Fetch PPN Percent dari Company Profile
                const resProfile = await fetch('http://localhost:5000/api/company-profile');
                const resultProfile = await resProfile.json();

                if (resultProfile.success && resultProfile.data?.ppn_percent !== undefined) {
                    setPpnPercent(resultProfile.data.ppn_percent);
                } else {
                    setError(resultProfile.message || 'Gagal memuat tarif PPN dari database.');
                }

                // 4. Jika mode Edit/Detail (poId ada), fetch detail PO
                if (poId) {
                    const resPo = await fetch(`http://localhost:5000/api/po/${poId}`);
                    const resultPo = await resPo.json();

                    if (resultPo.success && resultPo.data) {
                        const poHeader = resultPo.data.header || {};
                        const poItems = resultPo.data.items || [];

                        setPoStatus(poHeader.status || '');

                        // Format tanggal yyyy-MM-dd untuk input type="date"
                        if (poHeader.requested_delivery_date) {
                            const d = new Date(poHeader.requested_delivery_date);
                            setRequestedDeliveryDate(d.toISOString().split('T')[0]);
                        } else {
                            setRequestedDeliveryDate('');
                        }

                        setDeliveryAddress(poHeader.delivery_address || '');
                        setDescription(poHeader.description || '');

                        // Map items menggunakan poItems
                        if (poItems.length > 0) {
                            const mappedItems = poItems.map(item => ({
                                po_detail_id: item.po_detail_id,
                                id_product: item.id_product,
                                product_code: item.product_code || '',
                                product_name: item.product_name || '',
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

                            // Set search term awal
                            const initialSearch = {};
                            mappedItems.forEach((itm, idx) => {
                                if (itm.product_code || itm.product_name) {
                                    initialSearch[idx] = `${itm.product_code} - ${itm.product_name}`;
                                }
                            });
                            setSearchTerm(initialSearch);
                        }
                    } else {
                        setError(resultPo.message || 'Gagal memuat detail PO.');
                    }
                }
            } catch (err) {
                console.error('Error fetching data:', err);
                setError('Gagal terhubung ke server.');
            }
        };

        fetchData();
    }, [customerId, poId]);

    // Menghitung multiplier harga berdasarkan Base UOM dan Selected UOM
    const calculateUnitPrice = (basePrice, baseUom, selectedUom, pcsPerCtn, ctnPerPlt) => {
        const pCtn = parseFloat(pcsPerCtn) || 1;
        const cPlt = parseFloat(ctnPerPlt) || 1;
        let factor = 1;

        if (baseUom === 'PCS') {
            if (selectedUom === 'CTN') factor = pCtn;
            else if (selectedUom === 'PLT') factor = pCtn * cPlt;
        } else if (baseUom === 'CTN') {
            if (selectedUom === 'PCS') factor = 1 / pCtn;
            else if (selectedUom === 'PLT') factor = cPlt;
        } else if (baseUom === 'PLT') {
            if (selectedUom === 'CTN') factor = 1 / cPlt;
            else if (selectedUom === 'PCS') factor = 1 / (pCtn * cPlt);
        }

        return basePrice * factor;
    };

    // Handler saat produk dipilih dari dropdown
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

    // Handler Perubahan Qty
    const handleQtyChange = (index, rawValue) => {
        const cleanNumber = rawValue.replace(/\D/g, '');
        const qty = parseInt(cleanNumber, 10) || 0;

        const updatedItems = [...items];
        const item = updatedItems[index];
        item.qty = qty;
        item.total_price = (item.unit_price || 0) * qty;

        setItems(updatedItems);
    };

    // Handler Perubahan UOM
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

    // Tambah Baris
    const handleAddItem = () => {
        setItems([
            ...items,
            {
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
            }
        ]);
    };

    // Hapus Baris
    const handleRemoveItem = (index) => {
        if (items.length === 1) return;
        const updatedItems = items.filter((_, i) => i !== index);

        // Bersihkan state search term
        const newSearchTerm = { ...searchTerm };
        delete newSearchTerm[index];

        setSearchTerm(newSearchTerm);
        setItems(updatedItems);
    };

    // Ringkasan Kalkulasi
    const subtotal = items.reduce((sum, item) => sum + (item.total_price || 0), 0);
    const taxAmount = subtotal * (ppnPercent / 100);
    const grandTotal = subtotal + taxAmount;

    // Format Rupiah
    const formatCurrency = (val) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val || 0);
    };

    // Submit Form
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
            description: description,
            subtotal: subtotal,
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
            const url = poId ? `http://localhost:5000/api/po/${poId}` : 'http://localhost:5000/api/po';
            const method = poId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
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
            const res = await fetch(`http://localhost:5000/api/po/${poId}/cancel`, {
                method: 'PATCH'
            });
            const result = await res.json();
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

        // 1. Catatan HANYA diminta jika status Rejected
        if (newStatus === 'Rejected') {
            const inputNotes = prompt('Masukkan alasan penolakan PO (Wajib diisi):');

            // Jika user menekan tombol Cancel pada prompt, batalkan proses
            if (inputNotes === null) {
                return;
            }

            // Validasi agar alasan tidak kosong
            if (!inputNotes.trim()) {
                alert('Alasan penolakan wajib diisi!');
                return;
            }

            notes = inputNotes;
        }

        try {
            const response = await fetch(`http://localhost:5000/api/po/${poId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: newStatus,
                    notes: notes,
                    updated_by: customerId
                })
            });

            const result = await response.json();
            if (result.success) {
                // Notifikasi disesuaikan dengan aksi
                if (newStatus === 'Rejected') {
                    alert('PO berhasil ditolak!');
                } else if (newStatus === 'Waiting Batch Assignment') {
                    alert('PO berhasil disetujui!');
                } else {
                    alert(`Status PO berhasil diperbarui menjadi ${newStatus}!`);
                }

                if (onSuccess) onSuccess(); // Refresh list & tutup modal
            } else {
                alert(result.message || 'Gagal mengubah status PO.');
            }
        } catch (err) {
            console.error('Error updating status:', err);
            alert('Terjadi kesalahan koneksi server.');
        }
    };

    const renderStatusBadge = (status) => {
        return (
            <span style={{
                padding: '4px 10px',
                borderRadius: '12px',
                fontSize: '13px',
                fontWeight: 'bold',
                marginLeft: '10px',
                display: 'inline-block',
                ...getStatusStyle(status)
            }}>
                {status}
            </span>
        );
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
            <div style={{
                backgroundColor: '#fff', padding: '24px', borderRadius: '8px', width: '850px', maxHeight: '90vh', overflowY: 'auto'
            }}>
                <h2>
                    {poId ? `Detail Purchase Order #${poId}` : 'Buat Purchase Order (PO) Baru'}
                    {poId && poStatus && renderStatusBadge(poStatus)}
                </h2>
                {error && <p style={{ color: 'red' }}>{error}</p>}

                <form onSubmit={handleSubmit}>
                    {/* Header Input */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Tanggal Pengiriman Diminta *</label>
                            <input
                                type="date"
                                value={requestedDeliveryDate}
                                onChange={(e) => setRequestedDeliveryDate(e.target.value)}
                                required
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
                            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                        />
                    </div>

                    <hr style={{ margin: '20px 0' }} />

                    {/* Table Items */}
                    <h3>Daftar Produk</h3>
                    <table border="1" cellPadding="8" cellSpacing="0" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f2f2f2' }}>
                                <th style={{ width: '35%' }}>Produk</th>
                                <th style={{ width: '18%' }}>Harga Satuan</th>
                                <th style={{ width: '12%' }}>Qty</th>
                                <th style={{ width: '13%' }}>UOM</th>
                                <th style={{ width: '16%' }}>Total Harga</th>
                                <th style={{ width: '6%' }}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, index) => (
                                <tr key={index}>
                                    <td style={{ position: 'relative' }}>
                                        <input
                                            type="text"
                                            placeholder="Cari Kode / Nama..."
                                            value={searchTerm[index] !== undefined ? searchTerm[index] : ''}
                                            onFocus={() => setOpenDropdown(index)}
                                            onChange={(e) => {
                                                setSearchTerm({ ...searchTerm, [index]: e.target.value });
                                                setOpenDropdown(index);
                                            }}
                                            style={{ width: '100%', padding: '6px', boxSizing: 'border-box' }}
                                        />

                                        {openDropdown === index && (
                                            <div style={{
                                                position: 'absolute', top: '100%', left: 0, right: 0,
                                                maxHeight: '180px', overflowY: 'auto', backgroundColor: '#fff',
                                                border: '1px solid #ccc', borderRadius: '4px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', zIndex: 1000
                                            }}>
                                                {products
                                                    .filter(p => {
                                                        const kw = (searchTerm[index] || '').toLowerCase();
                                                        return p.product_code.toLowerCase().includes(kw) || p.product_name.toLowerCase().includes(kw);
                                                    })
                                                    .map(p => (
                                                        <div
                                                            key={p.id_product}
                                                            onClick={() => handleSelectProduct(index, p)}
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
                                            onChange={(e) => handleQtyChange(index, e.target.value)}
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
                                                onChange={(e) => handleUomChange(index, e.target.value)}
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
                                        {items.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveItem(index)}
                                                style={{ backgroundColor: '#dc3545', color: '#fff', border: 'none', padding: '4px 8px', cursor: 'pointer', borderRadius: '4px' }}
                                            >
                                                Hapus
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <button
                        type="button"
                        onClick={handleAddItem}
                        style={{ marginBottom: '20px', padding: '6px 12px', backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        + Tambah Baris Produk
                    </button>

                    {/* Total Summary */}
                    <div style={{ textAlign: 'right', marginBottom: '20px', fontSize: '14px' }}>
                        <p style={{ margin: '4px 0' }}>Subtotal: <strong>{formatCurrency(subtotal)}</strong></p>
                        <p style={{ margin: '4px 0' }}>
                            PPN ({ppnPercent !== null ? `${ppnPercent}%` : 'Loading...'}): {" "}
                            <strong>{formatCurrency(taxAmount)}</strong>
                        </p>
                        <h3 style={{ margin: '8px 0', color: '#007bff' }}>Grand Total: {formatCurrency(grandTotal)}</h3>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
                        <div>
                            {/* Tombol Batalkan PO (Satu tempat) KHUSUS Customer & Status Waiting for Confirmation */}
                            {poId && userRole === 'CUSTOMER' && poStatus === 'Waiting for Confirmation' && (
                                <button
                                    type="button"
                                    onClick={handleCancelPO}
                                    disabled={loading}
                                    style={{ padding: '8px 16px', backgroundColor: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                                >
                                    Batalkan PO
                                </button>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button type="button" onClick={onClose} style={{ padding: '8px 16px' }}>
                                Tutup
                            </button>

                            {/* Tombol aksi Approve & Reject KHUSUS PPIC / Non-Customer */}
                            {poId && userRole !== 'CUSTOMER' && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => handleUpdateStatus('Rejected')}
                                        style={{ padding: '8px 16px', backgroundColor: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                    >
                                        Reject PO
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleUpdateStatus('Waiting Batch Assignment')}
                                        style={{ padding: '8px 16px', backgroundColor: '#198754', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                    >
                                        Approve PO
                                    </button>
                                </>
                            )}

                            {/* Tombol Simpan HANYA untuk Customer saat membuat PO baru */}
                            {!poId && userRole === 'CUSTOMER' && (
                                <button type="submit" disabled={loading} style={{ padding: '8px 16px', backgroundColor: '#0d6efd', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                                    Simpan PO
                                </button>
                            )}
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default POCreate;
