'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildFamilyIndex } = require('../services/product-code-mapping/productFamilies');

const pair = (o, n) => ({ id_product_old: o, id_product_new: n });

test('tanpa pemetaan: tiap produk hanya dirinya sendiri', () => {
    const f = buildFamilyIndex([]);
    assert.deepEqual(f.familyOf(5), [5]);
    assert.equal(f.sameFamily(5, 5), true);
    assert.equal(f.sameFamily(5, 6), false);
    assert.deepEqual(buildFamilyIndex().familyOf(1), [1]);
});

test('satu pasangan: kedua arah sekeluarga', () => {
    const f = buildFamilyIndex([pair(1, 2)]);
    assert.deepEqual(f.familyOf(1), [1, 2]);
    assert.deepEqual(f.familyOf(2), [1, 2]);
    assert.equal(f.sameFamily(1, 2), true);
    assert.equal(f.sameFamily(2, 1), true);
    assert.equal(f.sameFamily(1, 3), false);
});

test('rantai A->B->C satu keluarga; banyak pendahulu satu pengganti', () => {
    const chain = buildFamilyIndex([pair(1, 2), pair(2, 3)]);
    assert.deepEqual(chain.familyOf(3), [1, 2, 3]);
    assert.equal(chain.sameFamily(1, 3), true);

    const many = buildFamilyIndex([pair(10, 30), pair(20, 30)]);
    assert.deepEqual(many.familyOf(10), [10, 20, 30]);
    assert.equal(many.sameFamily(10, 20), true);
});

test('dua keluarga terpisah tidak tercampur; urutan pasangan tidak berpengaruh', () => {
    const f = buildFamilyIndex([pair(1, 2), pair(7, 8), pair(8, 9)]);
    assert.deepEqual(f.familyOf(2), [1, 2]);
    assert.deepEqual(f.familyOf(9), [7, 8, 9]);
    assert.equal(f.sameFamily(1, 7), false);

    const a = buildFamilyIndex([pair(3, 2), pair(2, 1)]);
    const b = buildFamilyIndex([pair(2, 1), pair(3, 2)]);
    assert.deepEqual(a.familyOf(1), b.familyOf(1));
});

test('menyambung dua keluarga membuat satu keluarga; id teks dan angka setara', () => {
    const f = buildFamilyIndex([pair(1, 2), pair(3, 4), pair(2, 3)]);
    assert.deepEqual(f.familyOf(4), [1, 2, 3, 4]);
    assert.equal(f.sameFamily('1', 4), true);
    assert.deepEqual(buildFamilyIndex([pair('1', '2')]).familyOf(2), [1, 2]);
});

test('keluarga besar dengan jalur panjang tetap benar (kompresi jalur)', () => {
    const pairs = [];
    for (let i = 1; i < 200; i += 1) pairs.push(pair(i, i + 1));
    const f = buildFamilyIndex(pairs);
    assert.equal(f.familyOf(100).length, 200);
    assert.equal(f.sameFamily(1, 200), true);
});
