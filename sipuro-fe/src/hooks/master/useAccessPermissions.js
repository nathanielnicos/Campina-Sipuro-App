import { useState, useEffect, useCallback, useMemo } from 'react';
import { getAccessPermissions, saveAccessPermissions } from '../../services/permissionApi';
import { useGlobalModal } from '../../context/ModalContext';
import { usePermission } from '../../context/PermissionContext';

const cellKey = (group, menu, action) => `${group}|${menu}|${action}`;

/**
 * Matriks izin (SUPERADMIN): data server + perubahan yang belum disimpan (draft).
 * draft hanya berisi sel yang berbeda dari server; menyimpan mengirim sel-sel itu saja.
 */
export const useAccessPermissions = () => {
    const { showAlert, showConfirm } = useGlobalModal();
    const { refresh: refreshMyPermissions } = usePermission();

    const [view, setView] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [draft, setDraft] = useState({});
    const [activeGroup, setActiveGroup] = useState(null);
    const [historyVersion, setHistoryVersion] = useState(0);

    const fetchView = useCallback(async () => {
        try {
            setLoading(true);
            const res = await getAccessPermissions();
            if (res.success) {
                setView(res.data);
                setActiveGroup((current) => current || res.data.groups[0]);
            }
        } catch (err) {
            console.error('Failed to fetch access permissions:', err);
            showAlert({
                type: 'error',
                title: 'Error',
                message: err.response?.data?.message || 'Failed to fetch access permissions.'
            });
        } finally {
            setLoading(false);
        }
    }, [showAlert]);

    useEffect(() => {
        fetchView();
    }, [fetchView]);

    const serverAllowed = useCallback((group, menu, action) => (
        Boolean(view?.matrix?.[group]?.[menu]?.includes(action))
    ), [view]);

    const isChecked = (group, menu, action) => {
        const key = cellKey(group, menu, action);
        return Object.prototype.hasOwnProperty.call(draft, key) ? draft[key] : serverAllowed(group, menu, action);
    };

    const isChanged = (group, menu, action) => Object.prototype.hasOwnProperty.call(draft, cellKey(group, menu, action));

    const isLocked = (group, menu) => Boolean(view?.locked?.some((l) => l.group === group && l.menu === menu));

    const handleToggle = (group, menu, action) => {
        if (isLocked(group, menu) || saving) return;
        const key = cellKey(group, menu, action);
        const next = !isChecked(group, menu, action);
        setDraft((prev) => {
            const copy = { ...prev };
            if (next === serverAllowed(group, menu, action)) delete copy[key];
            else copy[key] = next;
            return copy;
        });
    };

    const pendingCount = Object.keys(draft).length;

    const pendingByGroup = useMemo(() => {
        const counts = {};
        Object.keys(draft).forEach((key) => {
            const group = key.split('|')[0];
            counts[group] = (counts[group] || 0) + 1;
        });
        return counts;
    }, [draft]);

    const handleDiscard = () => setDraft({});

    const applySave = async () => {
        const changes = Object.entries(draft).map(([key, allowed]) => {
            const [group, menu, action] = key.split('|');
            return { group, menu, action, allowed };
        });
        setSaving(true);
        try {
            const res = await saveAccessPermissions(changes);
            setView(res.data);
            setDraft({});
            setHistoryVersion((v) => v + 1);
            refreshMyPermissions();
            showAlert({ type: 'success', title: 'Success', message: res.message || 'Permissions saved.' });
        } catch (err) {
            showAlert({
                type: 'error',
                title: 'Failed',
                message: err.response?.data?.message || 'Failed to save permissions.'
            });
        } finally {
            setSaving(false);
        }
    };

    const handleSave = () => {
        if (pendingCount === 0) return;
        showConfirm({
            title: 'Save Permission Changes',
            message: `Save ${pendingCount} permission change(s)? They apply to every user in the affected groups.`,
            confirmText: 'Save',
            onConfirm: applySave
        });
    };

    return {
        view,
        loading,
        saving,
        activeGroup,
        setActiveGroup,
        pendingCount,
        pendingByGroup,
        historyVersion,
        isChecked,
        isChanged,
        isLocked,
        handleToggle,
        handleDiscard,
        handleSave
    };
};
