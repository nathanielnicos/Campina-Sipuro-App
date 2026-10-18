import { useMemo } from 'react';
import { calcOrderTotals } from '../../../utils/money';

export const usePODSummary = ({ items = [], ppnPercent = 0 }) => {
    const summary = useMemo(() => {
        // Aturan hitung yang sama dengan server (rupiah utuh), agar angka di layar = angka tersimpan.
        const totals = calcOrderTotals(items.map((item) => item.total_price), ppnPercent);

        return {
            subtotal: totals.subtotal,
            taxAmount: totals.ppnAmount,
            grandTotal: totals.total,
            isTooLarge: totals.tooLarge
        };
    }, [items, ppnPercent]);

    return summary;
};
