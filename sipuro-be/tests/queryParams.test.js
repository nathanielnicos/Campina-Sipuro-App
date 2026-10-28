'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { asText, parsePositiveInt, parseIdParam, parsePageParams, parseDateParam, escapeLike } = require('../helpers/queryParams');

test('asText: hanya teks, dipangkas; selain teks menjadi kosong', () => {
    assert.equal(asText('  abc '), 'abc');
    for (const v of [undefined, null, 5, {}, ['a']]) assert.equal(asText(v), '');
});

test('parsePositiveInt: bilangan bulat positif, selain itu bawaan', () => {
    assert.equal(parsePositiveInt('5', 1), 5);
    for (const v of ['0', '-3', 'abc', '', undefined, null]) assert.equal(parsePositiveInt(v, 7), 7);
});

test('parsePageParams: bawaan, batas maksimum, offset', () => {
    assert.deepEqual(parsePageParams({}), { page: 1, limit: 10, offset: 0 });
    assert.deepEqual(parsePageParams({ page: '3', limit: '20' }), { page: 3, limit: 20, offset: 40 });
    assert.equal(parsePageParams({ limit: '5000' }).limit, 100);
    assert.equal(parsePageParams({ limit: '5000' }, { maxLimit: 50 }).limit, 50);
    assert.deepEqual(parsePageParams({ page: '-1', limit: 'x' }, { defaultLimit: 25 }), { page: 1, limit: 25, offset: 0 });
});

test('parseDateParam: tanggal kalender yang ada; kosong null; salah 400', () => {
    assert.equal(parseDateParam('2026-02-28', 'D'), '2026-02-28');
    assert.equal(parseDateParam('  ', 'D'), null);
    assert.equal(parseDateParam(undefined, 'D'), null);
    for (const bad of ['2026-02-30', '2026-13-01', '26-01-01', '2026/01/01', 'abc']) {
        assert.throws(() => parseDateParam(bad, 'Tanggal'), (e) => e.status === 400 && /Tanggal/.test(e.message));
    }
});

test('escapeLike: % _ \\ menjadi teks biasa', () => {
    assert.equal(escapeLike('50%_a\\b'), '50\\%\\_a\\\\b');
    assert.equal(escapeLike('abc'), 'abc');
});

test('parseIdParam: ID bilangan bulat positif dengan pesan berlabel', () => {
    assert.equal(parseIdParam('15', 'Thing ID'), 15);
    assert.equal(parseIdParam(15, 'Thing ID'), 15);
    for (const bad of ['abc', '0', '-1', '1.5', '', undefined, null, '12abc', '9007199254740993', 1.5, {}, []]) {
        assert.throws(() => parseIdParam(bad, 'Thing ID'), (e) => e.status === 400 && e.message === 'A valid Thing ID is required.', String(bad));
    }
});
