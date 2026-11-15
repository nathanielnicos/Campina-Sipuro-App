import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { fetchEstimatedPo, fetchEstimatedReturnPo } from '../../../services/doApi';

export const ESTIMATE_MODE = Object.freeze({ DO: 'DO', RETURN: 'RETURN' });

/**
 * Perkiraan PO untuk DO atau retur yang sedang tampil. Hanya mengambil data saat `enabled`;
 * saat dimatikan, state dikosongkan. Hanya respons permintaan terakhir yang dipakai.
 *  - mode DO     : keys = id DO (delivery_order_id); getItem(doId, idProduct), getLot(doId, idProduct, lot)
 *  - mode RETURN : keys = nomor retur; getItem(returnNumber, idProduct), getLot(returnNumber, idProduct, lot)
 */
export const useEstimatedPo = (enabled, mode, keys) => {
    const [loaded, setLoaded] = useState({ mode: '', key: '', byKey: new Map() });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const requestSeq = useRef(0);

    const isReturn = mode === ESTIMATE_MODE.RETURN;
    const key = useMemo(() => {
        const unique = [...new Set(keys || [])];
        unique.sort(isReturn ? undefined : (a, b) => a - b);
        return unique.join(',');
    }, [keys, isReturn]);

    useEffect(() => {
        const seq = ++requestSeq.current;
        if (!enabled || !key) {
            setLoaded({ mode: '', key: '', byKey: new Map() });
            setLoading(false);
            setError('');
            return undefined;
        }
        (async () => {
            setLoading(true);
            setError('');
            try {
                const res = isReturn
                    ? await fetchEstimatedReturnPo(key.split(','))
                    : await fetchEstimatedPo(key.split(',').map(Number));
                if (seq !== requestSeq.current) return;
                if (res && res.success) {
                    const idOf = isReturn ? (entry) => entry.return_number : (entry) => entry.delivery_order_id;
                    setLoaded({ mode, key, byKey: new Map((res.data || []).map((entry) => [idOf(entry), entry])) });
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
    }, [enabled, mode, key, isReturn]);

    const current = loaded.mode === mode && loaded.key === key ? loaded.byKey : null;

    const getItem = useCallback((id, idProduct) => {
        const entry = current && current.get(id);
        return entry ? (entry.items || []).find((i) => i.id_product === idProduct) || null : null;
    }, [current]);

    const getLot = useCallback((id, idProduct, lotNumber) => {
        const item = getItem(id, idProduct);
        return item ? (item.lots || []).find((l) => l.lot_number === lotNumber) || null : null;
    }, [getItem]);

    return { enabled, mode, loading, error, getItem, getLot };
};

export default useEstimatedPo;
