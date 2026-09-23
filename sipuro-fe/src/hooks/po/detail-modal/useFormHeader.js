import { useState, useEffect, useCallback } from 'react';
import {
    fetchProducts,
    fetchCustomerDetail,
    fetchCompanyProfile,
    fetchPODetail
} from '../../../services/poApi';

export const useFormHeader = ({ poId, currentUser }) => {
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

    const loadPODetailData = useCallback(async (catalogProducts = []) => {
        if (!poId) return;
        try {
            const poRes = await fetchPODetail(poId);
            if (poRes.success && poRes.data) {
                const poHeader = poRes.data.header || {};
                const poItems = poRes.data.items || [];

                setPoStatus(poHeader.status || '');
                setPoCode(poHeader.po_number || poHeader.po_code || poHeader.po_no || `#${poId}`);
                setDeliveryAddress(poHeader.delivery_address || '');
                setDescription(poHeader.description || '');
                setRejectionReason(poHeader.rejection_reason || '');
                setRawPoItems(poItems);
            } else {
                setError(poRes.message || 'Failed to load PO details.');
            }
        } catch (err) {
            console.error('Error fetching PO detail:', err);
            setError('Failed to load PO details from server.');
        }
    }, [poId]);

    useEffect(() => {
        const initData = async () => {
            setLoading(true);
            try {
                let currentProducts = [];
                const prodRes = await fetchProducts();
                if (prodRes.success) {
                    currentProducts = prodRes.data || [];
                    setProducts(currentProducts);
                } else {
                    setError('Failed to load product catalog.');
                }

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
                    setError(profileRes.message || 'Failed to load VAT rate.');
                }

                if (poId) {
                    await loadPODetailData(currentProducts);
                }
            } catch (err) {
                console.error('Error fetching data:', err);
                setError('Failed to connect to the server.');
            } finally {
                setLoading(false);
            }
        };

        initData();
    }, [customerId, poId, loadPODetailData]);

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
