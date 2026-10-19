import {
    MAX_AMOUNT,
    AMOUNT_TOO_LARGE_MESSAGE,
    toCents,
    fromCents,
    calcLineTotal,
    calcOrderTotals,
    deriveUnitCents,
    getUnitPrice
} from './money';

/**
 * Tes aturan uang frontend. Nilai harapan sama persis dengan tes backend
 * (sipuro-be/tests/money.test.js) supaya angka di layar, di PDF, dan di database identik.
 * Semua nilai dihitung terpisah dengan aritmetika bilangan bulat eksak, tanpa BigInt.
 * Jalankan dengan: npm test
 */

test('batas nominal dan pesan', () => {
    expect(MAX_AMOUNT).toBe(9999999999999);
    expect(AMOUNT_TOO_LARGE_MESSAGE).toBe('Total PO amount is too large. Please reduce the quantity.');
});

test('total per baris: harga satuan (sen) x qty, dibulatkan setengah ke atas', () => {
    // [harga satuan dalam sen, qty, total rupiah yang diharapkan]
    const cases = [
        [123456, 3, 3704],
        [1, 1, 0],
        [50, 1, 1],
        [49, 1, 0],
        [250, 1, 3],
        [100, 1, 1],
        [1500000, 10, 150000],
        [100000, 7, 7000],
        [33333, 3, 1000],
        [123456, 1000000000, 1234560000000],
        [1, 1000000000, 10000000],
        [999999, 1000000000, 9999990000000],
        [99999999, 100000, 99999999000]
    ];
    cases.forEach(([unitCents, qty, expected]) => {
        expect(calcLineTotal(unitCents, qty)).toBe(expected);
    });
});

test('total per baris di atas batas tetap terhitung (untuk tampilan) dan melewati batas', () => {
    expect(calcLineTotal(1000000, 1000000000)).toBeGreaterThan(MAX_AMOUNT);
    expect(calcLineTotal(1000000000000, 1000000000)).toBeGreaterThan(MAX_AMOUNT);
});

test('subtotal, PPN (setengah ke atas dari subtotal), dan total', () => {
    // [total per baris, persen PPN, subtotal, PPN, total]
    const cases = [
        [[1000], 11, 1000, 110, 1110],
        [[150], 11, 150, 17, 167],
        [[50], 11, 50, 6, 56],
        [[1], 11, 1, 0, 1],
        [[5], 11, 5, 1, 6],
        [[100], 0, 100, 0, 100],
        [[3704], 11, 3704, 407, 4111],
        [[1000, 2000, 3000], 12, 6000, 720, 6720],
        [[999], 11.5, 999, 115, 1114],
        [[123456789], 11, 123456789, 13580247, 137037036],
        [[9000000000000], 11, 9000000000000, 990000000000, 9990000000000],
        [[5704], 11, 5704, 627, 6331],
        [[100000], 10, 100000, 10000, 110000],
        [[1], 0.5, 1, 0, 1],
        [[199], 0.5, 199, 1, 200]
    ];
    cases.forEach(([lineTotals, percent, subtotal, ppnAmount, total]) => {
        expect(calcOrderTotals(lineTotals, percent)).toEqual({ subtotal, ppnAmount, total, tooLarge: false });
    });
});

test('persen PPN berupa string atau tidak valid', () => {
    expect(calcOrderTotals([1000], '11.00')).toEqual({ subtotal: 1000, ppnAmount: 110, total: 1110, tooLarge: false });
    expect(calcOrderTotals([1000], 'abc')).toEqual({ subtotal: 1000, ppnAmount: 0, total: 1000, tooLarge: false });
    expect(calcOrderTotals([1000], -5)).toEqual({ subtotal: 1000, ppnAmount: 0, total: 1000, tooLarge: false });
    expect(calcOrderTotals([1000], null)).toEqual({ subtotal: 1000, ppnAmount: 0, total: 1000, tooLarge: false });
    expect(calcOrderTotals(undefined, 11)).toEqual({ subtotal: 0, ppnAmount: 0, total: 0, tooLarge: false });
});

test('batas nominal pesanan: tooLarge tepat di atas 9.999.999.999.999', () => {
    // Subtotal terbesar yang masih muat pada PPN 11% adalah 9.009.009.009.008.
    expect(calcOrderTotals([9009009009008], 11)).toEqual({
        subtotal: 9009009009008,
        ppnAmount: 990990990991,
        total: 9999999999999,
        tooLarge: false
    });
    expect(calcOrderTotals([9009009009009], 11).tooLarge).toBe(true);

    expect(calcOrderTotals([9999999999999], 0).tooLarge).toBe(false);
    expect(calcOrderTotals([9999999999999, 1], 0).tooLarge).toBe(true);
    expect(calcOrderTotals([9999999999999], 11).tooLarge).toBe(true);
});

test('toCents / fromCents', () => {
    expect(toCents('1234.56')).toBe(123456);
    expect(toCents(1234.56)).toBe(123456);
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents('abc')).toBe(0);
    expect(toCents(-5)).toBe(0);
    expect(toCents(null)).toBe(0);
    expect(fromCents(123456)).toBe(1234.56);
    expect(fromCents(0)).toBe(0);
});

test('harga satuan tersimpan pada baris PO dari server', () => {
    // Harga dasar per satuan dasar dikonversi ke satuan baris: 1.000,00 x 24 / 2 = 12.000.
    const converted = { qty: 2, base_qty: 24, base_price: '1000.00', total_price: '24000.00' };
    expect(deriveUnitCents(converted)).toBe(1200000);
    expect(getUnitPrice(converted)).toBe(12000);

    // Satuan sama dengan satuan dasar: harga satuan = harga dasar.
    const plain = { qty: 1, base_qty: 1, base_price: '8333.33', total_price: '8333' };
    expect(deriveUnitCents(plain)).toBe(833333);
    expect(getUnitPrice(plain)).toBe(8333.33);

    // Tanpa harga dasar, dipakai total dibagi qty.
    const fallback = { qty: 4, total_price: '1000.00' };
    expect(deriveUnitCents(fallback)).toBe(25000);
    expect(getUnitPrice(fallback)).toBe(250);

    // Data tidak lengkap menghasilkan 0.
    expect(deriveUnitCents({})).toBe(0);
    expect(deriveUnitCents({ qty: 0, base_qty: 0, base_price: '100.00' })).toBe(0);
    expect(deriveUnitCents(null)).toBe(0);
});
