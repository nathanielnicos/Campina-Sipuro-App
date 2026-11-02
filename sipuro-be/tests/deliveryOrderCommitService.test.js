'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { commitDeliveryOrderTransaction } = require('../services/delivery-order/deliveryOrderCommitService');
const { TRANS_TYPE } = require('../services/delivery-order/deliveryOrderRules');

let queries;
const makeConnection = () => ({
    query: async (sql, params) => {
        const text = sql.replace(/\s+/g, ' ').trim();
        queries.push({ text, params });
        if (/INSERT INTO delivery_order_upload_logs/.test(text)) return [{ insertId: 7 }];
        if (/SELECT id, do_number FROM delivery_orders/.test(text)) {
            return [params[0].map((n, i) => ({ id: 100 + i, do_number: n }))];
        }
        return [{}];
    }
});

const issueRow = (over = {}) => ({
    transType: TRANS_TYPE.ISSUE, transDateTime: '2025-12-01 08:55:17', itemCode: 'A', lotNumber: 'L1',
    referenceNum: 'DO1', qty: 100, rowHash: 'h1', ...over
});
const returnRow = (over = {}) => ({
    transType: TRANS_TYPE.RETURN, transDateTime: '2025-12-05 10:00:00', itemCode: 'A', lotNumber: 'L1',
    referenceNum: 'RT1', qty: 10, rowHash: 'h2', ...over
});
const line = (over = {}) => ({
    referenceNum: 'DO1', productId: 1, itemCode: 'A', lotNumber: 'L1', qtyPcs: 100, qtyCtn: 2.5,
    transDateTime: '2025-12-01 08:55:17', ...over
});

const run = (calculation) => commitDeliveryOrderTransaction(makeConnection(), {
    fileName: 'f.xlsx', processTimestamp: 'TS', fileHash: 'HASH', userId: 4, calculation
});

test.beforeEach(() => { queries = []; });

test('menyimpan log, detail, DO unik, baris lot, dan retur; tidak menyentuh po_details / alokasi', async () => {
    const result = await run({
        categorizedDetails: { newRows: [issueRow(), issueRow({ lotNumber: 'L2', rowHash: 'h3' }), returnRow()] },
        doLines: [line(), line({ lotNumber: 'L2', qtyPcs: 50 })],
        returnLines: [line({ referenceNum: 'RT1', qtyPcs: 10, transDateTime: '2025-12-05 10:00:00' })]
    });

    assert.deepEqual(result, { uploadLogId: 7, savedDoCount: 1, savedDoLineCount: 2, savedReturnCount: 1, savedRowCount: 3 });
    assert.ok(queries.every((q) => !/po_details|po_lot_allocations|delivery_order_allocations/.test(q.text)));

    const details = queries.find((q) => /INSERT INTO delivery_order_upload_details/.test(q.text));
    assert.deepEqual(details.params[0][0], [7, TRANS_TYPE.ISSUE, '2025-12-01 08:55:17', 'A', 'L1', 'DO1', 0, 100, 'h1']);
    assert.deepEqual(details.params[0][2], [7, TRANS_TYPE.RETURN, '2025-12-05 10:00:00', 'A', 'L1', 'RT1', 10, 0, 'h2']);

    const lots = queries.find((q) => /INSERT INTO delivery_order_lots/.test(q.text));
    assert.equal(lots.params[0].length, 2);
    assert.deepEqual(lots.params[0][0], [100, 1, 'L1', 100, 2.5, '2025-12-01 08:55:17', 7]);

    const returns = queries.find((q) => /INSERT INTO delivery_returns/.test(q.text));
    assert.deepEqual(returns.params[0][0], ['RT1', 1, 'L1', 10, 2.5, '2025-12-05 10:00:00', 7]);
});

test('nomor DO unik: banyak baris satu DO jadi satu header dengan tanggal paling awal, upsert memajukan tanggal', async () => {
    await run({
        categorizedDetails: { newRows: [issueRow()] },
        doLines: [
            line({ transDateTime: '2025-12-01 10:00:00' }),
            line({ lotNumber: 'L2', transDateTime: '2025-12-01 08:00:00' }),
            line({ referenceNum: 'DO2', transDateTime: '2025-12-02 08:00:00' })
        ],
        returnLines: []
    });
    const header = queries.find((q) => /INSERT INTO delivery_orders/.test(q.text));
    assert.match(header.text, /ON DUPLICATE KEY UPDATE do_datetime = LEAST\(do_datetime, VALUES\(do_datetime\)\)/);
    assert.deepEqual(header.params[0], [['DO1', '2025-12-01 08:00:00', 7], ['DO2', '2025-12-02 08:00:00', 7]]);
});

test('hanya retur (tanpa DO): tidak menulis delivery_orders / delivery_order_lots', async () => {
    const result = await run({ categorizedDetails: { newRows: [returnRow()] }, doLines: [], returnLines: [line({ referenceNum: 'RT1' })] });
    assert.equal(result.savedDoCount, 0);
    assert.ok(!queries.some((q) => /INSERT INTO delivery_orders|INSERT INTO delivery_order_lots/.test(q.text)));
});

test('potongan 500 baris untuk insert besar', async () => {
    const rows = Array.from({ length: 1200 }, (_, i) => issueRow({ rowHash: `h${i}` }));
    await run({ categorizedDetails: { newRows: rows }, doLines: [], returnLines: [] });
    assert.equal(queries.filter((q) => /INSERT INTO delivery_order_upload_details/.test(q.text)).length, 3);
});
