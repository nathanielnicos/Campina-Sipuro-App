import { useState, useEffect, useCallback } from 'react';
import { getUploadTransTypes, createUploadTransType, updateUploadTransType } from '../../services/uploadTransTypeApi';
import { useGlobalModal } from '../../context/ModalContext';

const EMPTY_FORM = { transType: '', direction: 'OUT', matchBy: 'BATCH_LOT' };

export const useUploadTransTypes = () => {
    const { showAlert, showConfirm } = useGlobalModal();

    const [types, setTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    // null = form menambah jenis baru; angka = mengubah jenis dengan ID itu
    const [editingId, setEditingId] = useState(null);

    const fetchTypes = useCallback(async () => {
        try {
            setLoading(true);
            const res = await getUploadTransTypes();
            if (res.success) setTypes(res.data);
        } catch (err) {
            showAlert({ type: 'error', title: 'Error', message: err.response?.data?.message || 'Failed to fetch trans types.' });
        } finally {
            setLoading(false);
        }
    }, [showAlert]);

    useEffect(() => {
        fetchTypes();
    }, [fetchTypes]);

    // Jenis lot-item hanya boleh mengurangi: arah IN otomatis berbasis batch
    const handleFormChange = (field, value) => {
        setForm((prev) => {
            const next = { ...prev, [field]: value };
            if (next.direction === 'IN') next.matchBy = 'BATCH_LOT';
            return next;
        });
    };

    const resetForm = () => {
        setForm(EMPTY_FORM);
        setEditingId(null);
    };

    const startEdit = (item) => {
        setEditingId(item.id);
        setForm({ transType: item.trans_type, direction: item.direction, matchBy: item.match_by });
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        setSaving(true);
        try {
            const res = editingId === null
                ? await createUploadTransType(form)
                : await updateUploadTransType(editingId, form);
            showAlert({ type: 'success', title: 'Success', message: res.message || 'Saved.' });
            resetForm();
            await fetchTypes();
        } catch (err) {
            showAlert({ type: 'error', title: 'Failed', message: err.response?.data?.message || 'Failed to save the trans type.' });
        } finally {
            setSaving(false);
        }
    };

    const applyStatus = async (item, nextActive) => {
        setSaving(true);
        try {
            const res = await updateUploadTransType(item.id, { isActive: nextActive });
            showAlert({ type: 'success', title: 'Success', message: res.message || 'Saved.' });
            await fetchTypes();
        } catch (err) {
            showAlert({ type: 'error', title: 'Failed', message: err.response?.data?.message || 'Failed to change the status.' });
        } finally {
            setSaving(false);
        }
    };

    const handleToggleStatus = (item) => {
        const nextActive = !item.is_active;
        showConfirm({
            title: nextActive ? 'Activate Trans Type' : 'Deactivate Trans Type',
            message: nextActive
                ? `Activate "${item.trans_type}"? Rows of this type in the next uploads will be processed.`
                : `Deactivate "${item.trans_type}"? Rows of this type in the next uploads will be ignored. Data that was already uploaded is not changed.`,
            confirmText: nextActive ? 'Activate' : 'Deactivate',
            isDanger: !nextActive,
            onConfirm: () => applyStatus(item, nextActive)
        });
    };

    return {
        types,
        loading,
        saving,
        form,
        editingId,
        handleFormChange,
        handleSubmit,
        resetForm,
        startEdit,
        handleToggleStatus
    };
};
