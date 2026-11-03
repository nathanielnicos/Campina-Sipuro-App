import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { fetchEstimatedPo } from '../../../services/doApi';

/**
 * Perkiraan PO untuk DO yang sedang tampil. Hanya mengambil data saat `enabled`;
 * saat dimatikan, state dikosongkan. Hanya respons permintaan terakhir yang dipakai.
 */
export const useEstimatedPo = (enabled, doIds) => {
    const [loaded, setLoaded] = useState({ key: '', byDo: new Map() });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const requestSeq = useRef(0);

    const key = useMemo(() => [...new Set(doIds)].sort((a, b) => a - b).join(','), [doIds]);

    useEffect(() => {
        const seq = ++requestSeq.current;
        if (!enabled || !key) {
            setLoaded({ key: '', byDo: new Map() });
            setLoading(false);
            setError('');
            return undefined;
        }
        (async () => {
            setLoading(true);
            setError('');
            try {
                const res = await fetchEstimatedPo(key.split(',').map(Number));
                if (seq !== requestSeq.current) return;
                if (res && res.success) {
                    setLoaded({ key, byDo: new Map((res.data || []).map((order) => [order.delivery_order_id, order])) });
                } else {
                    setError(res?.message || 'Failed to fetch estimated PO.');
                }
            } catch (err) {
                if (seq !== requestSeq.current) return;
                setError('An error occurred while loading estimated PO.');
            } finally {
                if (seq === requestSeq.current) setLoading(false);
            }
        })();
        return undefined;
    }, [enabled, key]);

    const current = loaded.key === key ? loaded.byDo : null;

    const getItem = useCallback((doId, idProduct) => {
        const order = current && current.get(doId);
        return order ? (order.items || []).find((i) => i.id_product === idProduct) || null : null;
    }, [current]);

    const getLot = useCallback((doId, idProduct, lotNumber) => {
        const item = getItem(doId, idProduct);
        return item ? (item.lots || []).find((l) => l.lot_number === lotNumber) || null : null;
    }, [getItem]);

    return { enabled, loading, error, getItem, getLot };
};

export default useEstimatedPo;
