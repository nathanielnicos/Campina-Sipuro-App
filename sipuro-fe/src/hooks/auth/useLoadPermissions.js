import { useState, useEffect, useCallback, useRef } from 'react';
import { getMyPermissions } from '../../services/permissionApi';

/**
 * Memuat izin pengguna yang login dari server setiap kali pengguna berganti (login / pemulihan sesi).
 * status: 'idle' (belum ada pengguna) | 'loading' | 'ready' | 'error'
 */
export const useLoadPermissions = (user) => {
    const [permissions, setPermissions] = useState({});
    const [status, setStatus] = useState('idle');
    const requestSeq = useRef(0);

    const userKey = user ? `${user.role}:${user.code}` : null;

    const load = useCallback(async () => {
        const seq = ++requestSeq.current;
        if (!userKey) {
            setPermissions({});
            setStatus('idle');
            return;
        }
        // Muat ulang saat sudah siap tidak menampilkan layar memuat lagi
        setStatus((current) => (current === 'ready' ? current : 'loading'));
        try {
            const res = await getMyPermissions();
            if (seq !== requestSeq.current) return;
            if (res && res.success && res.data) {
                setPermissions(res.data.permissions || {});
                setStatus('ready');
            } else {
                setStatus('error');
            }
        } catch (err) {
            if (seq !== requestSeq.current) return;
            console.error('Failed to load permissions:', err);
            setStatus('error');
        }
    }, [userKey]);

    useEffect(() => {
        load();
    }, [load]);

    return { permissions, status, reload: load };
};
