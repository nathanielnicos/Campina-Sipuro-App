'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseActorId, assertActorExists } = require('../services/production-lot/lotActor');

test('pelaku diambil dari token, bukan dari body', () => {
    assert.equal(parseActorId({ user: { id: 7 }, body: { userId: 99 } }), 7);
    assert.equal(parseActorId({ user: { id: '12' } }), 12);
});

test('tanpa pengguna atau id tidak valid ditolak 400', () => {
    for (const req of [undefined, {}, { user: {} }, { user: { id: 0 } }, { user: { id: -3 } }, { user: { id: 'abc' } }, { user: { id: null } }]) {
        assert.throws(() => parseActorId(req), (e) => e.status === 400);
    }
});

test('assertActorExists: pegawai harus ada', async () => {
    await assert.doesNotReject(assertActorExists({ query: async () => [[{ id: 1 }]] }, 1));
    await assert.rejects(assertActorExists({ query: async () => [[]] }, 1), (e) => e.status === 400 && /User not found/.test(e.message));
});
