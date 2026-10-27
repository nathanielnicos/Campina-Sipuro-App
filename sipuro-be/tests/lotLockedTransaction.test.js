'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { runInLockedTransaction } = require('../services/production-lot/lotLockedTransaction');
const { COMMIT_LOCK_NAME, COMMIT_LOCK_TIMEOUT_SECONDS } = require('../helpers/uploadConfig');

const makeDb = ({ acquired = 1, getConnectionError = null, commitError = null } = {}) => {
    const events = [];
    const connection = {
        events,
        query: async (sql, params) => {
            events.push(['query', sql.replace(/\s+/g, ' ').trim(), params]);
            if (/GET_LOCK/.test(sql)) return [[{ acquired }]];
            return [[]];
        },
        beginTransaction: async () => events.push(['begin']),
        commit: async () => { events.push(['commit']); if (commitError) throw commitError; },
        rollback: async () => events.push(['rollback']),
        release: () => events.push(['release'])
    };
    const db = { getConnection: async () => { if (getConnectionError) throw getConnectionError; return connection; } };
    return { db, events, connection };
};
const names = (events) => events.map((e) => (e[0] === 'query' ? e[1].split(' ')[1] || e[1] : e[0]));

test('urutan: ambil lock, READ COMMITTED, begin, pekerjaan, commit, lepas lock, lepas koneksi', async () => {
    const { db, events } = makeDb();
    const out = await runInLockedTransaction(db, async (conn) => {
        await conn.query('SELECT 1');
        return 'hasil';
    });
    assert.equal(out, 'hasil');
    assert.deepEqual(events.map((e) => e[0] === 'query' ? e[1].replace(/ .*/, '') + (e[1].includes('GET_LOCK') ? ':GET_LOCK' : e[1].includes('RELEASE_LOCK') ? ':RELEASE_LOCK' : e[1].includes('ISOLATION') ? ':ISO' : '') : e[0]), [
        'SELECT:GET_LOCK', 'SET:ISO', 'begin', 'SELECT', 'commit', 'SELECT:RELEASE_LOCK', 'release'
    ]);
    assert.deepEqual(events[0][2], [COMMIT_LOCK_NAME, COMMIT_LOCK_TIMEOUT_SECONDS]);
    assert.match(events[1][1], /READ COMMITTED/);
});

test('lock tidak didapat: 409 dengan pesan yang diberikan, tanpa transaksi, koneksi dilepas, tanpa RELEASE_LOCK', async () => {
    const { db, events } = makeDb({ acquired: 0 });
    let called = false;
    await assert.rejects(
        runInLockedTransaction(db, async () => { called = true; }, { busyMessage: 'Sedang sibuk' }),
        (e) => e.status === 409 && e.message === 'Sedang sibuk'
    );
    assert.equal(called, false);
    assert.ok(!events.some((e) => e[0] === 'begin'));
    assert.ok(!events.some((e) => e[0] === 'query' && /RELEASE_LOCK/.test(e[1])));
    assert.equal(events[events.length - 1][0], 'release');
});

test('pekerjaan gagal: rollback, lock dilepas, koneksi dilepas, error asli dilempar ulang', async () => {
    const { db, events } = makeDb();
    const boom = new Error('boom');
    await assert.rejects(runInLockedTransaction(db, async () => { throw boom; }), (e) => e === boom);
    const kinds = events.map((e) => e[0]);
    assert.ok(kinds.includes('rollback'));
    assert.ok(!kinds.includes('commit'));
    assert.ok(events.some((e) => e[0] === 'query' && /RELEASE_LOCK/.test(e[1])));
    assert.equal(kinds[kinds.length - 1], 'release');
});

test('commit gagal: tetap rollback dan melepas lock', async () => {
    const { db, events } = makeDb({ commitError: new Error('commit gagal') });
    await assert.rejects(runInLockedTransaction(db, async () => 1), /commit gagal/);
    assert.ok(events.some((e) => e[0] === 'rollback'));
    assert.ok(events.some((e) => e[0] === 'query' && /RELEASE_LOCK/.test(e[1])));
});

test('deadlock dan lock wait timeout database dijawab 409 yang ramah', async () => {
    for (const code of ['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT']) {
        const { db } = makeDb();
        const err = Object.assign(new Error('internal sql detail'), { code });
        await assert.rejects(
            runInLockedTransaction(db, async () => { throw err; }),
            (e) => e.status === 409 && /try again/.test(e.message) && !/sql detail/.test(e.message)
        );
    }
});

test('gagal mendapatkan koneksi: error dilempar, tidak ada yang dilepas', async () => {
    const { db } = makeDb({ getConnectionError: new Error('pool habis') });
    await assert.rejects(runInLockedTransaction(db, async () => 1), /pool habis/);
});

test('kegagalan melepas lock tidak menutupi hasil', async () => {
    const { db, connection } = makeDb();
    const original = connection.query;
    connection.query = async (sql, params) => {
        if (/RELEASE_LOCK/.test(sql)) throw new Error('release gagal');
        return original(sql, params);
    };
    const origError = console.error; console.error = () => {};
    try {
        assert.equal(await runInLockedTransaction(db, async () => 'ok'), 'ok');
    } finally { console.error = origError; }
    assert.equal(connection.events[connection.events.length - 1][0], 'release');
});
