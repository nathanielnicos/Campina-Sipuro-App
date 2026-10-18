import { useState, useEffect } from 'react';
import {
    fetchProducts,
    fetchCustomerDetail,
    fetchCompanyProfile,
    fetchPODetail
} from '../../../services/poApi';

export const usePODHeader = ({ poId, currentUser }) => {
    const userRole = currentUser?.role;
    const customerId = userRole === 'CUSTOMER' ? currentUser?.customer_id : null;
    const isCustomer = userRole === 'CUSTOMER';

    const [poCode, setPoCode] = useState('');
    const [poStatus, setPoStatus] = useState('');
    const [products, setProducts] = useState([]);
    const [deliveryAddress, setDeliveryAddress] = useState('');
    const [description, setDescription] = useState('');
    const [rejectionReason, setRejectionReason] = useState('');
    const [ppnPercent, setPpnPercent] = useState(null);
    const [rawPoItems, setRawPoItems] = useState([]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        // Mencegah pembaruan state jika modal sudah ditutup / PO berganti sebelum permintaan selesai
        let cancelled = false;

        const applyPODetail = (poRes) => {
            if (poRes.success && poRes.data) {
                const poHeader = poRes.data.header || {};
                const poItems = poRes.data.items || [];

                setPoStatus(poHeader.status || '');
                setPoCode(poHeader.po_number || poHeader.po_code || poHeader.po_no || `#${poId}`);
                setDeliveryAddress(poHeader.delivery_address || '');
                setDescription(poHeader.description || '');
                setRejectionReason(poHeader.rejection_reason || '');
                // PO yang sudah diajukan memakai persentase PPN yang tersimpan di PO itu sendiri.
                // Draft belum final (seperti keranjang), jadi memakai tarif PPN perusahaan saat ini.
                if (poHeader.ppn_percent !== undefined && poHeader.ppn_percent !== null) {
                    const storedPpn = Number(poHeader.ppn_percent);
                    setPpnPercent((currentPpn) => (
                        poHeader.status === 'Draft' && currentPpn !== null ? currentPpn : storedPpn
                    ));
                }
                setRawPoItems(poItems);
            } else {
                setError(poRes.message || 'Failed to load PO details.');
            }
        };

        const initData = async () => {
            setLoading(true);
            try {
                // Keempat permintaan tidak saling bergantung, jadi dijalankan bersamaan.
                const [prodRes, custRes, profileRes, poRes] = await Promise.all([
                    fetchProducts(),
                    customerId ? fetchCustomerDetail(customerId) : Promise.resolve(null),
                    fetchCompanyProfile(),
                    poId
                        ? fetchPODetail(poId).catch((err) => {
                            console.error('Error fetching PO detail:', err);
                            return { success: false, message: 'Failed to load PO details from server.' };
                        })
                        : Promise.resolve(null)
                ]);

                if (cancelled) return;

                // Hasil diterapkan berurutan seperti sebelumnya (data PO menimpa alamat & PPN default).
                if (prodRes.success) {
                    setProducts(prodRes.data || []);
                } else {
                    setError('Failed to load product catalog.');
                }

                if (custRes && custRes.success && custRes.data) {
                    setDeliveryAddress(custRes.data.delivery_address || '');
                }

                if (profileRes.success && profileRes.data?.ppn_percent !== undefined) {
                    setPpnPercent(profileRes.data.ppn_percent);
                } else {
                    setError(profileRes.message || 'Failed to load VAT rate.');
                }

                if (poRes) {
                    applyPODetail(poRes);
                }
            } catch (err) {
                if (cancelled) return;
                console.error('Error fetching data:', err);
                setError('Failed to connect to the server.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        initData();

        return () => {
            cancelled = true;
        };
    }, [customerId, poId]);

    return {
        poCode,
        poStatus,
        products,
        deliveryAddress,
        setDeliveryAddress,
        description,
        setDescription,
        rejectionReason,
        ppnPercent,
        rawPoItems,
        loading,
        error,
        isCustomer,
        customerId
    };
};
