'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { isValidEmail } = require('../helpers/emailValidation');

// Pola lama (rentan ReDoS), dipakai hanya sebagai pembanding perilaku
const OLD_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

test('email valid diterima', () => {
    ['a@b.c', 'nama.belakang@campina.co.id', 'user+tag@mail.example.com', 'x@y.z.w'].forEach((email) => {
        assert.equal(isValidEmail(email, 255), true, email);
    });
});

test('email tidak valid ditolak', () => {
    [
        '', 'abc', '@b.c', 'a@', 'a@b', 'a@.c', 'a@b.', 'a@@b.c', 'a@b@c.d',
        'a b@c.d', 'a@b .c', ' a@b.c', 'a@b.c ', 'a@b.c\n', 'a\t@b.c'
    ].forEach((email) => {
        assert.equal(isValidEmail(email, 255), false, JSON.stringify(email));
    });
});

test('bukan string atau terlalu panjang ditolak', () => {
    [undefined, null, 123, {}, []].forEach((value) => assert.equal(isValidEmail(value, 255), false));
    assert.equal(isValidEmail('a@b.c', 4), false);
    assert.equal(isValidEmail('a@b.c', 5), true);
});

test('perilaku sama dengan pola lama untuk semua string pendek (alfabet a @ . spasi)', () => {
    const alphabet = ['a', '@', '.', ' '];
    let checked = 0;
    const walk = (prefix, depth) => {
        if (prefix.length > 0) {
            assert.equal(isValidEmail(prefix, 1000), OLD_REGEX.test(prefix), JSON.stringify(prefix));
            checked += 1;
        }
        if (depth === 0) return;
        alphabet.forEach((ch) => walk(prefix + ch, depth - 1));
    };
    walk('', 7);
    assert.ok(checked > 20000);
});

test('input berpola serangan (ribuan pengulangan) selesai cepat', () => {
    const attack = `!@!.${'!.'.repeat(50000)}`;
    const started = Date.now();
    assert.equal(isValidEmail(attack, 1000000), true);
    assert.equal(isValidEmail(`${attack}\u0000 `, 1000000), false);
    assert.ok(Date.now() - started < 1000, 'seharusnya selesai dalam milidetik, bukan detik');
    // dengan batas panjang yang dipakai aplikasi, input sepanjang itu langsung ditolak
    assert.equal(isValidEmail(attack, 255), false);
});
