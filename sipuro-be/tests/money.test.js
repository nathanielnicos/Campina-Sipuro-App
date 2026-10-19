'use strict';

/**
 * Tes aturan uang (helpers/money.js).
 *
 * Semua nilai harapan dihitung terpisah dengan aritmetika bilangan bulat eksak
 * (pembulatan setengah ke atas) dan ditulis langsung di sini, tanpa BigInt.
 * Jalankan dengan: npm test
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const money = require('../helpers/money');

const {
    MAX_AMOUNT,
    MAX_ITEM_QTY,
    AmountTooLargeError,
    mulDivRound,
    toCents,
    fromCents,
    parseQty,
    calcLineTotal,
    calcOrderTotals
} = money;

test('batas yang berlaku', () => {
    assert.equal(MAX_AMOUNT, 9999999999999);
    assert.equal(MAX_ITEM_QTY, 1000000000);
});

test('total per baris: harga satuan (sen) x qty, dibulatkan setengah ke atas', () => {
    // [harga satuan dalam sen, qty, total rupiah yang diharapkan]
    const cases = [
        [123456, 3, 3704],            // 1.234,56 x 3 = 3.703,68
        [1, 1, 0],                    // 0,01 -> 0
        [50, 1, 1],                   // 0,50 -> 1 (setengah ke atas)
        [49, 1, 0],                   // 0,49 -> 0
        [250, 1, 3],                  // 2,50 -> 3
        [100, 1, 1],
        [1500000, 10, 150000],
        [100000, 7, 7000],
        [33333, 3, 1000],             // 999,99 -> 1.000
        [123456, 1000000000, 1234560000000],
        [1, 1000000000, 10000000],
        [999999, 1000000000, 9999990000000],
        [99999999, 100000, 99999999000]
    ];
    for (const [unitCents, qty, expected] of cases) {
        assert.equal(calcLineTotal(unitCents, qty), expected, `${unitCents} x ${qty}`);
    }
});

test('total per baris di atas batas ditolak dengan AmountTooLargeError', () => {
    for (const [unitCents, qty] of [[1000000, 1000000000], [1000000000000, 1000000000]]) {
        assert.throws(
            () => calcLineTotal(unitCents, qty),
            (error) => error instanceof AmountTooLargeError
                && error.isValidation === true
                && error.statusCode === 400
                && /too large/i.test(error.message)
        );
    }
});

test('subtotal, PPN (setengah ke atas dari subtotal), dan total', () => {
    // [total per baris, persen PPN, subtotal, PPN, total]
    const cases = [
        [[1000], 11, 1000, 110, 1110],
        [[150], 11, 150, 17, 167],               // 16,5 -> 17
        [[50], 11, 50, 6, 56],                   // 5,5 -> 6
        [[1], 11, 1, 0, 1],                      // 0,11 -> 0
        [[5], 11, 5, 1, 6],                      // 0,55 -> 1
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
    for (const [lineTotals, percent, subtotal, ppnAmount, total] of cases) {
        assert.deepEqual(
            calcOrderTotals(lineTotals, percent),
            { subtotal, ppnAmount, total },
            `${JSON.stringify(lineTotals)} @ ${percent}%`
        );
    }
});

test('persen PPN dari MySQL (string) dan nilai tidak valid', () => {
    assert.deepEqual(calcOrderTotals([1000], '11.00'), { subtotal: 1000, ppnAmount: 110, total: 1110 });
    assert.deepEqual(calcOrderTotals([1000], 'abc'), { subtotal: 1000, ppnAmount: 0, total: 1000 });
    assert.deepEqual(calcOrderTotals([1000], -5), { subtotal: 1000, ppnAmount: 0, total: 1000 });
    assert.deepEqual(calcOrderTotals([1000], null), { subtotal: 1000, ppnAmount: 0, total: 1000 });
});

test('batas nominal pesanan (subtotal + PPN <= 9.999.999.999.999)', () => {
    // Subtotal terbesar yang masih muat pada PPN 11% adalah 9.009.009.009.008.
    assert.deepEqual(calcOrderTotals([9009009009008], 11), {
        subtotal: 9009009009008,
        ppnAmount: 990990990991,
        total: 9999999999999
    });
    assert.throws(() => calcOrderTotals([9009009009009], 11), AmountTooLargeError);

    // Tanpa PPN, batasnya tepat pada nilai maksimum.
    assert.equal(calcOrderTotals([9999999999999], 0).total, 9999999999999);
    assert.throws(() => calcOrderTotals([9999999999999, 1], 0), AmountTooLargeError);
    assert.throws(() => calcOrderTotals([9999999999999], 11), AmountTooLargeError);
});

test('mulDivRound: a x b / c dibulatkan setengah ke atas', () => {
    // [a, b, c, hasil]
    const cases = [
        [100000, 12, 1, 1200000],
        [100000, 1, 12, 8333],
        [100000, 5, 12, 41667],
        [1, 1, 2, 1],
        [0, 5, 3, 0],
        [999999999999, 1000, 1000, 999999999999],
        [123456, 24, 2, 1481472],
        [10050, 12, 24, 5025]
    ];
    for (const [a, b, c, expected] of cases) {
        assert.equal(mulDivRound(a, b, c), expected, `${a} x ${b} / ${c}`);
    }
});

test('toCents / fromCents', () => {
    assert.equal(toCents('1234.56'), 123456);
    assert.equal(toCents(1234.56), 123456);
    assert.equal(toCents(0.1 + 0.2), 30);
    assert.equal(toCents('abc'), 0);
    assert.equal(toCents(-5), 0);
    assert.equal(toCents(null), 0);
    assert.equal(fromCents(123456), 1234.56);
    assert.equal(fromCents(0), 0);
});

test('parseQty: hanya bilangan bulat', () => {
    assert.equal(parseQty(5), 5);
    assert.equal(parseQty('12'), 12);
    assert.equal(parseQty(' 7 '), 7);
    assert.equal(parseQty(1.5), null);
    assert.equal(parseQty('1.5'), null);
    assert.equal(parseQty('1e3'), null);
    assert.equal(parseQty('-3'), null);
    assert.equal(parseQty(''), null);
    assert.equal(parseQty(null), null);
    assert.equal(parseQty(undefined), null);
    assert.equal(parseQty({}), null);
});
