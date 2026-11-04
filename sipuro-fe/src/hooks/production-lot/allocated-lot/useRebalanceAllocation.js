import { useState, useCallback } from 'react';
import {
    fetchRebalanceProductsApi,
    previewAllocationRebalanceApi,
    commitAllocationRebalanceApi
} from '../../../services/productionLotApi';
import { useGlobalModal } from '../../../context/ModalContext';

const REASON_MAX_LENGTH = 50;

const useRebalanceAllocation = (onRefresh) => {
    const { showConfirm, showAlert } = useGlobalModal();

    const [isOpen, setIsOpen] = useState(false);
    const [products, setProducts] = useState([]);
    const [productId, setProductId] = useState('');
    const [preview, setPreview] = useState(null);
    const [reason, setReason] = useState('');
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [previewing, setPreviewing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleOpen = useCallback(async () => {
        setIsOpen(true);
        setProductId('');
        setPreview(null);
        setReason('');
        setError('');
        setLoadingProducts(true);
        const res = await fetchRebalanceProductsApi();
        if (res && res.success) {
            setProducts(res.data || []);
        } else {
            setError(res?.message || 'Failed to load products.');
        }
        setLoadingProducts(false);
    }, []);

    const handleClose = useCallback(() => {
        if (saving) return;
        setIsOpen(false);
        setPreview(null);
    }, [saving]);

    // Mengganti produk membuang pratinjau lama: yang bisa disimpan selalu hasil pratinjau produk yang sedang dipilih
    const handleProductChange = (value) => {
        setProductId(value);
        setPreview(null);
        setError('');
    };

    const handlePreview = async () => {
        if (!productId) return;
        setPreviewing(true);
        setError('');
        setPreview(null);
        const res = await previewAllocationRebalanceApi(Number(productId));
        if (res && res.success) {
            setPreview(res.data);
        } else {
            setError(res?.message || 'Failed to preview the allocation rebalance.');
        }
        setPreviewing(false);
    };

    const executeCommit = async () => {
        setSaving(true);
        const res = await commitAllocationRebalanceApi({
            productId: Number(productId),
            fingerprint: preview.fingerprint,
            reason: reason.trim()
        });
        setSaving(false);
        if (res && res.success) {
            showAlert({ type: 'success', title: 'Success', message: res.message || 'Allocation rebalanced.' });
            setIsOpen(false);
            setPreview(null);
            if (onRefresh) onRefresh();
            return;
        }
        // Data berubah sejak pratinjau atau ada penghalang: pratinjau lama tidak boleh dipakai lagi
        setPreview(null);
        const detail = res?.problems && res.problems.length > 0 ? `\n- ${res.problems.join('\n- ')}` : '';
        showAlert({ type: 'error', title: 'Failed', message: `${res?.message || 'Failed to rebalance the allocation.'}${detail}` });
    };

    const handleCommit = () => {
        if (!preview || !preview.canApply) return;
        if (!reason.trim()) {
            setError('Reason is required.');
            return;
        }
        setError('');
        showConfirm({
            title: 'Rebalance Allocation',
            message: `Apply ${preview.changes.length} allocation change(s)? Manual edits listed in the preview will be reversed. This cannot be undone automatically.`,
            confirmText: 'Apply Rebalance',
            onConfirm: executeCommit
        });
    };

    return {
        isOpen, products, productId, preview, reason, error,
        loadingProducts, previewing, saving, reasonMaxLength: REASON_MAX_LENGTH,
        setReason, handleOpen, handleClose, handleProductChange, handlePreview, handleCommit
    };
};

export default useRebalanceAllocation;
