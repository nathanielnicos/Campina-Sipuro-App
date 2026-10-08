/**
 * Tes calculator alokasi produksi. Tanpa library tambahan.
 * Jalankan:
 *   node tests/productionCalculator.test.js
 *   TZ=UTC node tests/productionCalculator.test.js          (meniru Vercel)
 *   (Windows PowerShell)  $env:TZ="UTC"; node tests/productionCalculator.test.js
 */
const assert = require('assert');
const { calculateFifoAllocation, computeAllocationFingerprint } = require('../helpers/productionCalculatorHelper');
const { BusinessError } = require('../helpers/businessError');

const products = [
    { id_product: 1, product_code: 'X', product_name: 'Produk X' },
    { id_product: 2, product_code: 'Y', product_name: 'Produk Y' },
    { id_product: 3, product_code: 'Z', product_name: 'Produk Z' }
];

const po = (id, header, number, productId, code, base, fulfilled, created, extra = {}) => ({
    po_detail_id: id, po_header_id: header, id_product: productId, base_qty: base, fulfilled_qty: fulfilled,
    detail_status: 'Active', po_number: number, created_at: created, header_status: 'Approved',
    product_code: code, product_name: `Produk ${code}`, ...extra
});

let seq = 0;
const row = (batch, code, qty, start, completed, extra = {}) => ({
    batchNumber: batch, lotNumber: `L${++seq}`, itemCode: code, lotStatus: 'GOOD', qtyPac: qty,
    actualStartDatetime: start, actualCompletedDatetime: completed,
    rowHash: `h${seq}`, excelRowNumber: seq + 6, ...extra
});

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// ---------------------------------------------------------------------------
test('Contoh PO1/PO2 dan BATCH1-BATCH6 sesuai gambar', () => {
    seq = 0;
    const pos = [
        po(11, 1, 'PO1', 1, 'X', 100, 0, '2026-01-01 08:00:00'),
        po(12, 1, 'PO1', 2, 'Y', 200, 0, '2026-01-01 08:00:00'),
        po(21, 2, 'PO2', 2, 'Y', 300, 0, '2026-01-02 08:00:00'),
        po(22, 2, 'PO2', 3, 'Z', 400, 0, '2026-01-02 08:00:00')
    ];
    const d = (n) => `2026-02-0${n} 08:00:00`;
    const rows = [
        row('BATCH1', 'X', 50, d(1), d(1)), row('BATCH1', 'X', -30, d(1), d(1)), row('BATCH1', 'X', 80, d(1), d(1)),
        row('BATCH2', 'Y', 100, d(2), d(2)), row('BATCH2', 'Y', 150, d(2), d(2)),
        row('BATCH3', 'Y', 150, d(3), d(3)),
        row('BATCH4', 'Y', 200, d(4), d(4)),
        row('BATCH5', 'Z', 300, d(5), d(5)),
        row('BATCH6', 'Z', -50, d(6), d(6)), row('BATCH6', 'Z', 50, d(6), d(6))
    ];
    const r = calculateFifoAllocation(rows, [], pos, products);

    const flat = r.detailedAllocations.map((a) => `${a.batchNumber}>${a.poDetailId}:${a.addedQty}:${a.rowStatus}`);
    assert.deepStrictEqual(flat, [
        'BATCH1>11:100:Closed',
        'BATCH2>12:200:Closed',
        'BATCH2>21:50:Open',
        'BATCH3>21:150:Open',
        'BATCH5>22:300:Open'
    ]);

    const un = r.unallocatedRows.map((x) => `${x.batchNumber}:${x.qtyPac}:${x.reason}`);
    assert.deepStrictEqual(un, [
        'BATCH4:200:Exceeds PO capacity',
        'BATCH6:-50:Net quantity is zero',
        'BATCH6:50:Net quantity is zero'
    ]);
    assert.strictEqual(r.summary.newCount, 4);
    assert.strictEqual(r.summary.validRowCount, 7);
    assert.strictEqual(r.newRows.length, 7);
    assert.strictEqual(r.canSave, true);
});

// ---------------------------------------------------------------------------
test('Contoh 550/750: baris 500 tidak teralokasi, 100/200/250 ke PO001, 50 + 400 ke PO002', () => {
    seq = 0;
    const pos = [
        po(1, 1, 'PO001', 1, 'X', 550, 0, '2026-01-01 08:00:00'),
        po(2, 2, 'PO002', 1, 'X', 750, 0, '2026-01-02 08:00:00')
    ];
    const rows = [100, 200, 300, 400, 500].map((q, i) =>
        row(`B${i + 1}`, 'X', q, `2026-02-0${i + 1} 08:00:00`, `2026-02-0${i + 1} 09:00:00`));
    const r = calculateFifoAllocation(rows, [], pos, products);
    const flat = r.detailedAllocations.map((a) => `${a.batchNumber}>${a.poDetailId}:${a.addedQty}`);
    assert.deepStrictEqual(flat, ['B1>1:100', 'B2>1:200', 'B3>1:250', 'B3>2:50', 'B4>2:400']);
    assert.deepStrictEqual(r.unallocatedRows.map((x) => x.batchNumber), ['B5']);
    // Status akhir: PO001 penuh -> semua baris PO001 tampil Closed, termasuk B1 dan B2
    const po1 = r.detailedAllocations.filter((a) => a.poDetailId === 1).map((a) => a.rowStatus);
    assert.deepStrictEqual(po1, ['Closed', 'Closed', 'Closed']);
});

// ---------------------------------------------------------------------------
test('Grup yang sebagian muat tidak dialokasikan sama sekali', () => {
    seq = 0;
    const pos = [po(1, 1, 'PO1', 1, 'X', 60, 0, '2026-01-01 08:00:00')];
    const rows = [row('B1', 'X', 100, '2026-02-01 08:00:00', '2026-02-01 09:00:00')];
    const r = calculateFifoAllocation(rows, [], pos, products);
    assert.strictEqual(r.previewResults.length, 0);
    assert.strictEqual(r.newRows.length, 0);
    assert.strictEqual(r.canSave, false);
    assert.strictEqual(r.unallocatedRows[0].reason, 'Exceeds PO capacity');
});

// ---------------------------------------------------------------------------
test('Filter tanggal: batch lebih awal dari tanggal PO tidak dialokasikan', () => {
    seq = 0;
    const pos = [po(1, 1, 'PO1', 1, 'X', 500, 0, '2026-03-10 08:00:00')];
    const rows = [
        row('B1', 'X', 10, '2026-03-09 23:00:00', '2026-03-11 01:00:00'),
        row('B2', 'X', 10, '2026-03-10 00:30:00', '2026-03-10 05:00:00')
    ];
    const r = calculateFifoAllocation(rows, [], pos, products);
    assert.deepStrictEqual(r.previewResults.map((b) => b.batchNumber), ['B2']);
    assert.strictEqual(r.unallocatedRows[0].reason, 'No matching open PO');
});

// ---------------------------------------------------------------------------
test('Tanggal start atau completed kosong -> Unallocated (Missing production date)', () => {
    seq = 0;
    const pos = [po(1, 1, 'PO1', 1, 'X', 500, 0, '2026-01-01 08:00:00')];
    const rows = [
        row('B1', 'X', 10, '2026-02-01 08:00:00', null),
        row('B2', 'X', 10, '2026-02-01 08:00:00', '2026-02-01 09:00:00'),
        row('B2', 'X', 10, null, '2026-02-01 09:00:00')
    ];
    const r = calculateFifoAllocation(rows, [], pos, products);
    assert.strictEqual(r.previewResults.length, 0);
    assert.ok(r.unallocatedRows.every((x) => x.reason === 'Missing production date'));
    assert.strictEqual(r.unallocatedRows.length, 3);
});

// ---------------------------------------------------------------------------
test('Header PO selain Approved/Production Completed dan detail selain Active diabaikan', () => {
    seq = 0;
    const pos = [
        po(1, 1, 'PO-DRAFT', 1, 'X', 500, 0, '2026-01-01 08:00:00', { header_status: 'Draft' }),
        po(2, 2, 'PO-PC', 1, 'X', 500, 0, '2026-01-02 08:00:00', { detail_status: 'Partially Closed' }),
        po(3, 3, 'PO-OK', 1, 'X', 500, 0, '2026-01-03 08:00:00', { header_status: 'Production Completed' })
    ];
    const rows = [row('B1', 'X', 10, '2026-02-01 08:00:00', '2026-02-01 09:00:00')];
    const r = calculateFifoAllocation(rows, [], pos, products);
    assert.deepStrictEqual(r.detailedAllocations.map((a) => a.poDetailId), [3]);
});

// ---------------------------------------------------------------------------
test('Close Requested hanya memblokir produk yang ada di file, dan semua PO dilaporkan', () => {
    seq = 0;
    const pos = [
        po(1, 1, 'PO-A', 1, 'X', 100, 0, '2026-01-01 08:00:00', { detail_status: 'Close Requested' }),
        po(2, 2, 'PO-B', 1, 'X', 100, 0, '2026-01-02 08:00:00', { detail_status: 'Close Requested' }),
        po(3, 3, 'PO-C', 2, 'Y', 100, 0, '2026-01-03 08:00:00')
    ];
    // File hanya berisi Y -> tidak diblokir
    const okRows = [row('B1', 'Y', 10, '2026-02-01 08:00:00', '2026-02-01 09:00:00')];
    const ok = calculateFifoAllocation(okRows, [], pos, products);
    assert.strictEqual(ok.previewResults.length, 1);
    // File berisi X -> diblokir
    const badRows = [row('B2', 'X', 10, '2026-02-01 08:00:00', '2026-02-01 09:00:00')];
    assert.throws(() => calculateFifoAllocation(badRows, [], pos, products), (e) =>
        e instanceof BusinessError && e.status === 409 &&
        e.message.includes('PO-A') && e.message.includes('PO-B'));
});

// ---------------------------------------------------------------------------
test('Minus: mengurangi PO terbaru dulu, status akhir dihitung ulang', () => {
    seq = 0;
    const pos = [
        po(1, 1, 'PO-OLD', 1, 'X', 60, 60, '2026-01-01 08:00:00'),
        po(2, 2, 'PO-NEW', 1, 'X', 40, 40, '2026-01-05 08:00:00')
    ];
    const ctx = {
        existingBatches: [{ id: 10, batch_number: 'B1', id_product: 1 }],
        existingAllocations: [
            { id: 100, po_detail_id: 1, id_batch: 10, allocated_qty: 60, status: 'Closed' },
            { id: 101, po_detail_id: 2, id_batch: 10, allocated_qty: 40, status: 'Closed' }
        ]
    };
    const rows = [row('B1', 'X', -70, '2026-02-01 08:00:00', '2026-02-01 09:00:00')];
    const r = calculateFifoAllocation(rows, [], pos, products, ctx);
    const flat = r.detailedAllocations.map((a) => `${a.poDetailId}:${a.addedQty}:${a.rowStatus}`);
    assert.deepStrictEqual(flat, ['2:-40:Open', '1:-30:Open']);
    assert.strictEqual(r.previewResults[0].allocations[0].fulfillmentPercentage, '0.0');
});

test('Minus melebihi alokasi, atau tanpa alokasi, atau PO tidak aktif -> Unallocated dengan alasan', () => {
    seq = 0;
    const pos = [po(1, 1, 'PO1', 1, 'X', 100, 30, '2026-01-01 08:00:00')];
    const ctx = {
        existingBatches: [
            { id: 10, batch_number: 'B1', id_product: 1 },
            { id: 11, batch_number: 'B3', id_product: 1 }
        ],
        existingAllocations: [
            { id: 100, po_detail_id: 1, id_batch: 10, allocated_qty: 30, status: 'Open' },
            { id: 101, po_detail_id: 99, id_batch: 11, allocated_qty: 20, status: 'Open' } // PO 99 tidak aktif
        ]
    };
    const t = (b) => ['2026-02-01 08:00:00', '2026-02-01 09:00:00'].map(String);
    const rows = [
        row('B1', 'X', -31, ...t()),
        row('B2', 'X', -5, ...t()),
        row('B3', 'X', -5, ...t())
    ];
    const r = calculateFifoAllocation(rows, [], pos, products, ctx);
    const map = Object.fromEntries(r.unallocatedRows.map((x) => [x.batchNumber, x.reason]));
    assert.deepStrictEqual(map, {
        B1: 'Reduction exceeds allocated quantity',
        B2: 'No existing allocation to reduce',
        B3: 'PO or PO detail not active'
    });
});

test('Kapasitas yang dibuka minus bisa dipakai plus sesudahnya (urutan start)', () => {
    seq = 0;
    const pos = [po(1, 1, 'PO1', 1, 'X', 100, 100, '2026-01-01 08:00:00')];
    const ctx = {
        existingBatches: [{ id: 10, batch_number: 'OLD', id_product: 1 }],
        existingAllocations: [{ id: 100, po_detail_id: 1, id_batch: 10, allocated_qty: 100, status: 'Closed' }]
    };
    const rows = [
        row('NEW', 'X', 40, '2026-02-02 08:00:00', '2026-02-02 09:00:00'),
        row('OLD', 'X', -40, '2026-02-01 08:00:00', '2026-02-01 09:00:00')
    ];
    const r = calculateFifoAllocation(rows, [], pos, products, ctx);
    assert.deepStrictEqual(r.previewResults.map((b) => b.batchNumber), ['OLD', 'NEW']);
    assert.strictEqual(r.detailedAllocations[1].rowStatus, 'Closed');
});

// ---------------------------------------------------------------------------
test('Pasangan PO-batch Canceled/Force Closed dilewati', () => {
    seq = 0;
    const pos = [
        po(1, 1, 'PO1', 1, 'X', 100, 0, '2026-01-01 08:00:00'),
        po(2, 2, 'PO2', 1, 'X', 100, 0, '2026-01-02 08:00:00')
    ];
    const ctx = {
        existingBatches: [{ id: 10, batch_number: 'B1', id_product: 1 }],
        existingAllocations: [{ id: 100, po_detail_id: 1, id_batch: 10, allocated_qty: 0, status: 'Force Closed' }]
    };
    const rows = [row('B1', 'X', 10, '2026-02-01 08:00:00', '2026-02-01 09:00:00')];
    const r = calculateFifoAllocation(rows, [], pos, products, ctx);
    assert.deepStrictEqual(r.detailedAllocations.map((a) => a.poDetailId), [2]);
});

// ---------------------------------------------------------------------------
test('Konflik nomor batch: produk lain di DB, atau dua item code di file yang sama', () => {
    seq = 0;
    const pos = [
        po(1, 1, 'PO1', 1, 'X', 100, 0, '2026-01-01 08:00:00'),
        po(2, 1, 'PO1', 2, 'Y', 100, 0, '2026-01-01 08:00:00')
    ];
    const ctx = { existingBatches: [{ id: 10, batch_number: 'DBB', id_product: 2 }] };
    const rows = [
        row('DBB', 'X', 10, '2026-02-01 08:00:00', '2026-02-01 09:00:00'),
        row('SAME', 'X', 10, '2026-02-01 08:00:00', '2026-02-01 09:00:00'),
        row('SAME', 'Y', 10, '2026-02-01 08:00:00', '2026-02-01 09:00:00')
    ];
    const r = calculateFifoAllocation(rows, [], pos, products, ctx);
    assert.strictEqual(r.previewResults.length, 0);
    assert.ok(r.unallocatedRows.every((x) => x.reason === 'Batch number conflicts with another product'));
});

// ---------------------------------------------------------------------------
test('Kategori lain: duplicate, status update, non-GOOD, unregistered', () => {
    seq = 0;
    const pos = [po(1, 1, 'PO1', 1, 'X', 100, 0, '2026-01-01 08:00:00')];
    const dup = row('D1', 'X', 5, '2026-02-01 08:00:00', '2026-02-01 09:00:00');
    const dupStatus = row('D2', 'X', 5, '2026-02-01 08:00:00', '2026-02-01 09:00:00', { lotStatus: 'HOLD' });
    const nonGood = row('N1', 'X', 5, '2026-02-01 08:00:00', '2026-02-01 09:00:00', { lotStatus: 'HOLD' });
    const unreg = row('U1', 'QQ', 5, '2026-02-01 08:00:00', '2026-02-01 09:00:00');
    const good = row('G1', 'X', 5, '2026-02-01 08:00:00', '2026-02-01 09:00:00');
    const r = calculateFifoAllocation([dup, dupStatus, nonGood, unreg, good], [dup.rowHash, dupStatus.rowHash], pos, products);
    assert.strictEqual(r.summary.duplicateCount, 1);
    assert.strictEqual(r.summary.duplicateStatusUpdateCount, 1);
    assert.strictEqual(r.summary.nonGoodCount, 1);
    assert.strictEqual(r.summary.unregisteredCount, 1);
    assert.strictEqual(r.summary.newCount, 1);
    assert.strictEqual(r.summary.totalRows, 5);
});

// ---------------------------------------------------------------------------
test('Urutan deterministik dan sidik jari stabil; berubah jika PO berubah', () => {
    const make = (fulfilled) => {
        seq = 0;
        const pos = [po(1, 1, 'PO1', 1, 'X', 100, fulfilled, '2026-01-01 08:00:00')];
        const rows = [
            row('B2', 'X', 10, '2026-02-01 08:00:00', '2026-02-01 09:00:00'),
            row('B1', 'X', 10, '2026-02-01 08:00:00', '2026-02-01 09:00:00')
        ];
        return calculateFifoAllocation(rows, [], pos, products);
    };
    const a = make(0), b = make(0), c = make(10);
    assert.deepStrictEqual(a.previewResults.map((x) => x.batchNumber), ['B1', 'B2']);
    assert.strictEqual(computeAllocationFingerprint(a), computeAllocationFingerprint(b));
    assert.notStrictEqual(computeAllocationFingerprint(a), computeAllocationFingerprint(c));
});

// ---------------------------------------------------------------------------
test('created_at PO sebagai string tidak bergantung timezone server', () => {
    seq = 0;
    // PO dibuat 10 Okt 02:00 WIB. Batch mulai 09 Okt harus DITOLAK baik di server WIB maupun UTC.
    const pos = [po(1, 1, 'PO1', 1, 'X', 100, 0, '2026-10-10 02:00:00')];
    const rows = [row('B1', 'X', 10, '2026-10-09 23:00:00', '2026-10-10 23:00:00')];
    const r = calculateFifoAllocation(rows, [], pos, products);
    assert.strictEqual(r.previewResults.length, 0);
});

// ---------------------------------------------------------------------------
let failed = 0;
tests.forEach(({ name, fn }) => {
    try { fn(); console.log(`  PASS  ${name}`); }
    catch (e) { failed++; console.log(`  FAIL  ${name}\n        ${e.message}`); }
});
console.log(`\n${tests.length - failed}/${tests.length} tests passed (TZ=${process.env.TZ || 'system default'})`);
process.exit(failed ? 1 : 0);
