import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { fetchEstimatedPo, fetchEstimatedReturnPo } from '../../../services/doApi';

export const ESTIMATE_MODE = Object.freeze({ DO: 'DO', RETURN: 'RETURN' });

const toNum = (v) => Number(v) || 0;

/**
 * Menggabungkan beberapa lot satu item menjadi satu entri (PO yang sama dijumlahkan).
 * Dipakai tampilan Summary: bila pencarian menyaring lot, qty baris hanya memuat lot yang tampil,
 * jadi perkiraan PO-nya pun hanya boleh memuat lot yang sama.
 */
export const mergeEstimateLots = (lots) => {
    const byPo = new Map();
    let unassigned = 0;
    let returned = 0;
    let unmatched = 0;
    let unassignedReleased = 0;
    lots.forEach((lot) => {
        unassigned += toNum(lot.unassigned_qty);
        returned += toNum(lot.returned_qty);
        unmatched += toNum(lot.unmatched_qty);
        unassignedReleased += toNum(lot.unassigned_released_qty);
        (lot.pos || []).forEach((po) => {
            let cur = byPo.get(po.po_detail_id);
            if (!cur) {
                cur = { ...po, qty_pcs: 0, returned_pcs: 0, from: Array.isArray(po.from) ? [] : undefined };
                byPo.set(po.po_detail_id, cur);
            }
            cur.qty_pcs += toNum(po.qty_pcs);
            cur.returned_pcs += toNum(po.returned_pcs);
            if (Array.isArray(po.from)) {
                po.from.forEach((f) => {
                    const hit = cur.from.find((x) => x.do_number === f.do_number);
                    if (hit) hit.qty_pcs += toNum(f.qty_pcs);
                    else cur.from.push({ ...f, qty_pcs: toNum(f.qty_pcs) });
                });
            }
        });
    });
    return {
        pos: [...byPo.values()],
        unassigned_qty: unassigned,
        returned_qty: returned,
        unmatched_qty: unmatched,
        unassigned_released_qty: unassignedReleased
    };
};

/**
 * Perkiraan PO untuk DO atau retur yang sedang tampil. Hanya mengambil data saat `enabled`;
 * saat dimatikan, state dikosongkan. Hanya respons permintaan terakhir yang dipakai.
 *  - mode DO     : keys = id DO (delivery_order_id); getItem(doId, idProduct), getLot(doId, idProduct, lot)
 *  - mode RETURN : keys = nomor retur; getItem(returnNumber, idProduct), getLot(returnNumber, idProduct, lot)
 *  - getItemForLots(id, idProduct, lotNumbers): gabungan hanya lot yang tampil (untuk Summary)
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

    // Perkiraan item hanya dari lot yang tampil (lotNumbers kosong = semua lot)
    const getItemForLots = useCallback((id, idProduct, lotNumbers) => {
        const item = getItem(id, idProduct);
        if (!item || !Array.isArray(lotNumbers) || lotNumbers.length === 0) return item;
        const wanted = new Set(lotNumbers);
        const lots = (item.lots || []).filter((l) => wanted.has(l.lot_number));
        return lots.length > 0 ? { id_product: item.id_product, ...mergeEstimateLots(lots) } : null;
    }, [getItem]);

    return { enabled, mode, loading, error, getItem, getLot, getItemForLots };
};

export default useEstimatedPo;
