import { useState, useEffect, useCallback } from 'react';
import { getPoSettings, updatePoSettings } from '../../services/superadminApi';
import { useGlobalModal } from '../../context/ModalContext';

export const useSetting = () => {
    const { showConfirm, showAlert } = useGlobalModal();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [poSetting, setPoSetting] = useState({
        template_pattern: '',
        reset_cycle: 'YEARLY',
        description: '',
        preview_po_number: '',
        next_seq: 1
    });

    const fetchPoSettings = useCallback(async () => {
        try {
            setLoading(true);
            const res = await getPoSettings();
            if (res.success && res.data) {
                setPoSetting({
                    template_pattern: res.data.template_pattern || '',
                    reset_cycle: res.data.reset_cycle || 'YEARLY',
                    description: res.data.description || '',
                    preview_po_number: res.data.preview_po_number || '',
                    next_seq: res.data.next_seq || 1
                });
            }
        } catch (err) {
            console.error('Failed to load PO settings:', err);
            showAlert({
                type: 'error',
                title: 'Error',
                message: err.response?.data?.message || 'Failed to fetch PO settings.'
            });
        } finally {
            setLoading(false);
        }
    }, [showAlert]);

    useEffect(() => {
        fetchPoSettings();
    }, [fetchPoSettings]);

    const executeSavePoSetting = async () => {
        try {
            setSaving(true);
            const res = await updatePoSettings({
                template_pattern: poSetting.template_pattern,
                reset_cycle: poSetting.reset_cycle,
                description: poSetting.description
            });

            if (res.success) {
                if (res.data?.preview_po_number) {
                    setPoSetting((prev) => ({
                        ...prev,
                        preview_po_number: res.data.preview_po_number,
                        next_seq: res.data.next_seq || prev.next_seq
                    }));
                }
                showAlert({
                    type: 'success',
                    title: 'Success',
                    message: res.message || 'PO settings updated successfully!'
                });
            } else {
                showAlert({
                    type: 'error',
                    title: 'Save Failed',
                    message: res.message || 'Failed to update PO settings.'
                });
            }
        } catch (err) {
            console.error('Failed to save PO settings:', err);
            showAlert({
                type: 'error',
                title: 'Error',
                message: err.response?.data?.message || 'An error occurred while saving PO settings.'
            });
        } finally {
            setSaving(false);
        }
    };

    const handleSavePoSetting = (e) => {
        if (e) e.preventDefault();

        showConfirm({
            title: 'Save PO Settings',
            message: 'Are you sure you want to save these PO numbering pattern settings?',
            confirmText: 'Save Settings',
            onConfirm: () => executeSavePoSetting()
        });
    };

    return {
        loading,
        saving,
        poSetting,
        setPoSetting,
        fetchPoSettings,
        handleSavePoSetting
    };
};
