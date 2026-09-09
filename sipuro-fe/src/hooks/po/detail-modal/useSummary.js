import { useMemo } from 'react';

export const useSummary = ({ items = [], ppnPercent = 0 }) => {
    const summary = useMemo(() => {
        const subtotal = items.reduce((sum, item) => sum + (item.total_price || 0), 0);
        const taxAmount = subtotal * ((ppnPercent || 0) / 100);
        const grandTotal = subtotal + taxAmount;

        return {
            subtotal,
            taxAmount,
            grandTotal
        };
    }, [items, ppnPercent]);

    return summary;
};
