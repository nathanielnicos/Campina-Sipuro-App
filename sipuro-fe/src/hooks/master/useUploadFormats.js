import { useState, useEffect, useCallback } from 'react';
import { getUploadFormats, updateUploadFormat } from '../../services/uploadFormatApi';
import { useGlobalModal } from '../../context/ModalContext';
import { toDraft, toDefaultDraft, cleanLetters, toPayload, isDraftChanged } from './uploadFormatDraft';

const SCOPE_TITLE = { LOT: 'Production Lot Upload', DO: 'Delivery Order Upload' };

export const useUploadFormats = () => {
    const { showAlert, showConfirm } = useGlobalModal();

    // Format tersimpan di server per scope, dan isian yang sedang diketik per scope
    const [formats, setFormats] = useState({});
    const [drafts, setDrafts] = useState({});
    const [loading, setLoading] = useState(true);
    const [savingScope, setSavingScope] = useState(null);

    // Menyimpan format dari server (daftar scope) sebagai nilai tersimpan sekaligus isian layar; scope lain tidak disentuh
    const applyFromServer = useCallback((list) => {
        setFormats((prev) => ({ ...prev, ...Object.fromEntries(list.map((f) => [f.scope, f])) }));
        setDrafts((prev) => ({ ...prev, ...Object.fromEntries(list.map((f) => [f.scope, toDraft(f)])) }));
    }, []);

    const fetchFormats = useCallback(async () => {
        try {
            setLoading(true);
            const res = await getUploadFormats();
            if (res.success) applyFromServer(res.data);
        } catch (err) {
            showAlert({ type: 'error', title: 'Error', message: err.response?.data?.message || 'Failed to fetch upload formats.' });
        } finally {
            setLoading(false);
        }
    }, [showAlert, applyFromServer]);

    useEffect(() => {
        fetchFormats();
    }, [fetchFormats]);

    const handleFieldChange = (scope, field, value) => {
        setDrafts((prev) => ({
            ...prev,
            [scope]: { ...prev[scope], [field]: field === 'timestampCell' ? cleanLetters(value) : value }
        }));
    };

    const handleColumnChange = (scope, key, value) => {
        setDrafts((prev) => ({
            ...prev,
            [scope]: { ...prev[scope], columns: { ...prev[scope].columns, [key]: cleanLetters(value) } }
        }));
    };

    // Hanya mengisi isian dengan nilai bawaan; belum disimpan sampai tombol Save ditekan
    const handleResetToDefault = (scope) => {
        setDrafts((prev) => ({ ...prev, [scope]: toDefaultDraft(formats[scope]) }));
    };

    const applySave = async (scope) => {
        setSavingScope(scope);
        try {
            const res = await updateUploadFormat(scope, toPayload(drafts[scope]));
            if (res.data) applyFromServer([res.data]);
            showAlert({ type: 'success', title: 'Success', message: res.message || 'Saved.' });
        } catch (err) {
            showAlert({ type: 'error', title: 'Failed', message: err.response?.data?.message || 'Failed to save the upload format.' });
        } finally {
            setSavingScope(null);
        }
    };

    const handleSave = (scope) => {
        showConfirm({
            title: 'Save Upload Format',
            message: `Save the ${SCOPE_TITLE[scope]} format? The next uploads will be read with these columns. Data that was already uploaded is not changed.`,
            confirmText: 'Save',
            onConfirm: () => applySave(scope)
        });
    };

    const isChanged = (scope) => Boolean(formats[scope] && drafts[scope] && isDraftChanged(formats[scope], drafts[scope]));

    return {
        formats,
        drafts,
        loading,
        savingScope,
        isChanged,
        handleFieldChange,
        handleColumnChange,
        handleResetToDefault,
        handleSave
    };
};
