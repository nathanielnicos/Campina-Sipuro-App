/**
 * Run from the backend root:  node --test tests/documentFlow.test.js
 * Pure logic only (no database, no Excel library): PO resolver, FIFO matcher, calculator, fingerprint.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { resolvePoReferences, buildRegisteredPoMap } = require('../helpers/upload-document-flow/poExtractorHelper');
const { allocateFifo } = require('../helpers/upload-document-flow/fifoMatcherHelper');
const {
    calculateDocumentFlow,
    computeDocumentFlowFingerprint
} = require('../helpers/upload-document-flow/documentFlowCalculatorHelper');
const { generateDoRowHash, generateSiRowHash } = require('../helpers/upload-document-flow/hashGeneratorHelper');

// ------------------------------------------------------------------ PO resolver
const DB_POS = [
    '044/PO/CRMI/2025', '044/PO/CRMI/2026', '051/PO/CRMI/2024', '051/PO/CRMI/2026', '188/PO/CRMI/2025',
    '009/PO/CRMI/2026', '062/PO/CRMI/2026', '162/PO/CRMI/2025', '078/PO/CRMI/2026', '003/CAM/2023', '004CAM/2023'
];
const poMap = buildRegisteredPoMap(DB_POS.map((po_number, i) => ({ po_number, po_header_id: i + 1 })));
const resolve = (text) => resolvePoReferences(text, poMap);
const matched = (text) => resolve(text).matched.slice().sort();

test('PO resolver: the 8 sample cells from the user', () => {
    const cases = [
        ['044/PO/CRMI/2025-03082026-IV', ['044/PO/CRMI/2025']],
        ['044/PO/CRMI/2025-CRMI/10072026/04/WW', ['044/PO/CRMI/2025']],
        ['188/PO/CRMI/2025+009/PO/CRMI/2026-04082026-VI.', ['009/PO/CRMI/2026', '188/PO/CRMI/2025']],
        ['051/PO/CRMI/2026 & 044/PO/CRMI/2026', ['044/PO/CRMI/2026', '051/PO/CRMI/2026']],
        ['044/PO/CRMI/2026 + 051/PO/CRMI/2026-140826-III', ['044/PO/CRMI/2026', '051/PO/CRMI/2026']],
        ['062/PO/CRMI/2026,162+188/PO/CRMI/2025-180826-VII', ['062/PO/CRMI/2026', '162/PO/CRMI/2025', '188/PO/CRMI/2025']],
        ['044/PO/CRMI/2026+ 009/PO/CRMI/2026-010926-III', ['009/PO/CRMI/2026', '044/PO/CRMI/2026']],
        ['078/PO/CRMI/2026 +051/PO/CRMI/2024-140926-VI', ['051/PO/CRMI/2024', '078/PO/CRMI/2026']]
    ];
    cases.forEach(([text, expected]) => {
        const r = resolve(text);
        assert.deepEqual(matched(text), expected, text);
        assert.deepEqual(r.unknown, [], `${text} must have no unknown PO`);
    });
});

test('PO resolver: shorthand number inherits the tail of the next full PO', () => {
    const r = resolve('062/PO/CRMI/2026,162+188/PO/CRMI/2025-180826-VII');
    assert.deepEqual(r.expanded, [{ from: '162', to: '162/PO/CRMI/2025' }]);
});

test('PO resolver: unregistered PO (full or shorthand) is reported with its position', () => {
    const text = '044/PO/CRMI/2025 & 999/PO/CRMI/2025';
    const r = resolve(text);
    assert.deepEqual(r.matched, ['044/PO/CRMI/2025']);
    assert.equal(r.unknown.length, 1);
    assert.equal(r.unknown[0].text, '999/PO/CRMI/2025');
    assert.equal(text.slice(r.unknown[0].start, r.unknown[0].end), '999/PO/CRMI/2025');

    const shorthand = '777+188/PO/CRMI/2025';
    const s = resolve(shorthand);
    assert.equal(s.unknown[0].text, '777/PO/CRMI/2025');
    assert.equal(shorthand.slice(s.unknown[0].start, s.unknown[0].end), '777'); // only the bare number is highlighted
});

test('PO resolver: boundaries, stray numbers and lower case / extra spaces', () => {
    assert.deepEqual(matched('1044/PO/CRMI/2025'), []);
    assert.deepEqual(matched('044/PO/CRMI/20255'), []);
    assert.deepEqual(resolve('044/PO/CRMI/2025-1408+051/PO/CRMI/2026').unknown, []); // suffix digits are not a PO
    assert.deepEqual(matched('  044/po/crmi/2025 \n- 03082026 '), ['044/PO/CRMI/2025']);
    assert.deepEqual(matched('SOME FREE TEXT'), []);
    assert.deepEqual(resolve('SOME FREE TEXT').unknown, []);
});

test('PO resolver: a registered PO without the slash is still found literally', () => {
    assert.deepEqual(matched('004CAM/2023-1'), ['004CAM/2023']);
    assert.deepEqual(matched('003/CAM/2023'), ['003/CAM/2023']);
});

// ------------------------------------------------------------------ FIFO matcher
const alloc = (allocationId, fifoDate, extra = {}) => ({ allocationId, fifoDate, poNumber: 'P', ...extra });

test('FIFO: oldest first, split over several allocations, ledger is consumed', () => {
    const candidates = [alloc(2, '2026-08-02 10:00:00'), alloc(1, '2026-08-01 10:00:00'), alloc(3, '2026-08-02 10:00:00')];
    const ledger = new Map([[1, 100], [2, 50], [3, 500]]);
    const r = allocateFifo({ qtyPcs: 180, doCreatedAt: '2026-08-05 08:00:00', candidates, ledger });
    assert.equal(r.ok, true);
    assert.deepEqual(r.parts.map((p) => [p.allocation.allocationId, p.qtyPcs]), [[1, 100], [2, 50], [3, 30]]);
    assert.deepEqual([...ledger.entries()], [[1, 0], [2, 0], [3, 470]]);
});

test('FIFO: DO creation must be >= completed date (equal is allowed)', () => {
    const candidates = [alloc(1, '2026-08-03 08:00:00')];
    let r = allocateFifo({ qtyPcs: 10, doCreatedAt: '2026-08-03 07:59:59', candidates, ledger: new Map([[1, 100]]) });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'NOT_COMPLETED_YET');
    r = allocateFifo({ qtyPcs: 10, doCreatedAt: '2026-08-03 08:00:00', candidates, ledger: new Map([[1, 100]]) });
    assert.equal(r.ok, true);
});

test('FIFO: insufficient capacity is rejected as a whole and consumes nothing', () => {
    const candidates = [alloc(1, '2026-08-01 00:00:00'), alloc(2, '2026-08-02 00:00:00')];
    const ledger = new Map([[1, 20000], [2, 5000]]);
    const r = allocateFifo({ qtyPcs: 30096, doCreatedAt: '2026-08-10 00:00:00', candidates, ledger });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'INSUFFICIENT');
    assert.match(r.message, /30096 pcs needed, 25000 pcs available/);
    assert.deepEqual([...ledger.entries()], [[1, 20000], [2, 5000]]);
});

test('FIFO: no allocation / fully delivered reasons', () => {
    assert.equal(allocateFifo({ qtyPcs: 1, doCreatedAt: 'x', candidates: [], ledger: new Map() }).reason, 'NO_ALLOCATION');
    const r = allocateFifo({ qtyPcs: 1, doCreatedAt: '2026-08-10 00:00:00', candidates: [alloc(1, '2026-08-01 00:00:00')], ledger: new Map([[1, 0]]) });
    assert.equal(r.reason, 'NO_CAPACITY');
});

// ------------------------------------------------------------------ Calculator
const PRODUCTS = [
    { id_product: 1, product_code: 'FG-ST-00060', product_name: 'PF WW CHOC COATED STICK', pcs_per_ctn: 12 },
    { id_product: 2, product_code: 'FG-ST-00058', product_name: 'PF WW CRUNCHY', pcs_per_ctn: 25 },
    { id_product: 3, product_code: 'FG-NO-MASTER', product_name: 'No pcs per ctn', pcs_per_ctn: 0 }
];
const PO_ROWS = [
    { po_header_id: 10, po_number: '044/PO/CRMI/2025' },
    { po_header_id: 11, po_number: '051/PO/CRMI/2026' }
];
const allocationRow = (id, productId, poNumber, allocatedQty, completedAt, consumed = 0) => ({
    allocation_id: id,
    po_detail_id: id * 10,
    allocated_qty: allocatedQty,
    allocation_status: 'Open',
    po_header_id: poNumber === '044/PO/CRMI/2025' ? 10 : 11,
    id_product: productId,
    po_number: poNumber,
    po_created_at: '2026-07-01 09:00:00',
    batch_id: id,
    batch_number: `B-${id}`,
    actual_completed_at: completedAt,
    fifo_date: completedAt,
    consumed_qty: consumed
});

let rowNo = 8;
const row = (over = {}) => ({
    excelRowNumber: rowNo++,
    itemCode: 'FG-ST-00060',
    customerPoText: '044/PO/CRMI/2025-03082026-I',
    doNumber: `34000${rowNo}`,
    deliveryStatus: 'Interfaced',
    invoiceNumber: `91000${rowNo}`,
    canceledInvoice: 'NO',
    qtyCtnDO: 100,
    qtyCtnSI: 100,
    pickUpDate: '2026-08-03',
    siDate: '2026-08-03',
    doCreatedAt: '2026-08-03 08:33:02',
    parseErrors: [],
    ...over
});

const run = (rows, over = {}) => calculateDocumentFlow({
    rows,
    existingHashes: [],
    allProducts: PRODUCTS,
    poRows: PO_ROWS,
    allocations: [allocationRow(1, 1, '044/PO/CRMI/2025', 100000, '2026-08-01 10:00:00')],
    latestSavedDoAt: null,
    ...over
});

test('Calculator: a valid row gets pcs conversion and one allocation line', () => {
    const calc = run([row()]);
    assert.equal(calc.summary.validCount, 1);
    const r = calc.previewResults[0];
    assert.equal(r.qtyPcs, 1200);
    assert.deepEqual(r.allocations.map((a) => [a.allocationId, a.qtyPcs, a.qtyCtn, a.poNumber, a.batchNumber]), [[1, 1200, 100, '044/PO/CRMI/2025', 'B-1']]);
    assert.equal(r.rowHashDO, generateDoRowHash(r.doNumber, 1));
    assert.equal(r.rowHashSI, generateSiRowHash(r.invoiceNumber, r.doNumber, 1));
    assert.equal(calc.canSave, true);
});

test('Calculator: Non-Interfaced rows are not validated and not saved', () => {
    const calc = run([row({ deliveryStatus: 'Cancelled', doNumber: '', invoiceNumber: '', qtyCtnDO: 0, qtyCtnSI: 0, pickUpDate: null, siDate: null, doCreatedAt: null }), row()]);
    assert.equal(calc.summary.nonInterfacedCount, 1);
    assert.equal(calc.summary.validCount, 1);
    assert.equal(calc.rowsToFix.length, 0);
    assert.equal(calc.canSave, true);
});

test('Calculator: empty mandatory columns and parse errors block saving and name the Excel row', () => {
    const bad = row({ invoiceNumber: '', pickUpDate: null });
    const parseBad = row({ doCreatedAt: null, parseErrors: [{ column: 'DO Creation Date', message: 'Invalid date/time "x"' }] });
    const calc = run([bad, parseBad, row()]);
    assert.equal(calc.rowsToFix.length, 2);
    assert.deepEqual(calc.rowsToFix[0].problems.map((p) => p.column).sort(), ['Invoice No.', 'Pick Up Date']);
    assert.equal(calc.rowsToFix[0].excelRowNumber, bad.excelRowNumber);
    assert.deepEqual(calc.rowsToFix[1].problems.map((p) => p.column), ['DO Creation Date']);
    assert.equal(calc.canSave, false);
});

test('Calculator: unregistered SKU, product master without pcs_per_ctn, and PO not registered', () => {
    const calc = run([
        row({ itemCode: 'FG-UNKNOWN' }),
        row({ itemCode: 'FG-NO-MASTER' }),
        row({ customerPoText: '999/PO/CRMI/2025' }),
        row({ customerPoText: '044/PO/CRMI/2025 & 888/PO/CRMI/2025' }),
        row({ customerPoText: 'NOTHING HERE' })
    ]);
    assert.equal(calc.summary.unregisteredCount, 5);
    assert.equal(calc.summary.validCount, 0);
    assert.equal(calc.rowsToFix.length, 0, 'unregistered rows do not block saving by themselves');
    const [sku, master, po, partial, none] = calc.unregisteredRows;
    assert.equal(sku.unregisteredSku, true);
    assert.equal(sku.reasons[0].type, 'SKU');
    assert.equal(master.reasons[0].type, 'SKU_MASTER');
    assert.equal(po.unknownPo[0].text, '999/PO/CRMI/2025');
    assert.equal(partial.unknownPo[0].text, '888/PO/CRMI/2025');
    assert.equal(none.poNotFound, true);
});

test('Calculator: unregistered rows do not block valid rows from being saved', () => {
    const calc = run([row({ itemCode: 'FG-UNKNOWN' }), row()]);
    assert.equal(calc.canSave, true);
    assert.equal(calc.summary.validCount, 1);
});

test('Calculator: duplicate in database (DO or SI hash) is Duplicate', () => {
    const r1 = row();
    const hashDO = generateDoRowHash(r1.doNumber, 1);
    const r2 = row();
    const hashSI = generateSiRowHash(r2.invoiceNumber, r2.doNumber, 1);
    const calc = run([r1, r2, row()], { existingHashes: [hashDO, hashSI] });
    assert.equal(calc.summary.duplicateCount, 2);
    assert.equal(calc.summary.validCount, 1);
});

test('Calculator: same DO + item twice in one file puts BOTH rows in Rows to Fix', () => {
    const a = row({ doNumber: '3400009999' });
    const b = row({ doNumber: '3400009999', invoiceNumber: '9100009999' });
    const calc = run([a, b, row()]);
    assert.equal(calc.rowsToFix.length, 2);
    assert.match(calc.rowsToFix[0].problems[0].message, new RegExp(`row ${b.excelRowNumber}`));
    assert.match(calc.rowsToFix[1].problems[0].message, new RegExp(`row ${a.excelRowNumber}`));
    assert.equal(calc.canSave, false);
});

test('Calculator: Qty Delivery must equal Qty Invoice; fractional pcs is rejected', () => {
    const mismatch = row({ qtyCtnSI: 99 });
    const fractional = row({ itemCode: 'FG-ST-00058', qtyCtnDO: 598.5, qtyCtnSI: 598.5, customerPoText: '044/PO/CRMI/2025' }); // 598.5 x 25 = 14962.5
    const wholeHalf = row({ qtyCtnDO: 598.5, qtyCtnSI: 598.5 }); // 598.5 x 12 = 7182
    const calc = run([mismatch, fractional, wholeHalf]);
    assert.equal(calc.rowsToFix.length, 2);
    assert.match(calc.rowsToFix[0].problems[0].message, /Qty Delivery \(100\) is different from Qty Invoice \(99\)/);
    assert.match(calc.rowsToFix[1].problems[0].message, /14962.5 pcs, which is not a whole number/);
    assert.equal(calc.previewResults[0].qtyPcs, 7182);
});

test('Calculator: FIFO ledger is shared by all rows of the file, ordered by DO creation then row', () => {
    const allocations = [
        allocationRow(1, 1, '044/PO/CRMI/2025', 1500, '2026-08-01 10:00:00'),
        allocationRow(2, 1, '044/PO/CRMI/2025', 1500, '2026-08-02 10:00:00')
    ];
    const later = row({ doCreatedAt: '2026-08-04 09:00:00', qtyCtnDO: 100, qtyCtnSI: 100 }); // 1200 pcs, listed first in the file
    const earlier = row({ doCreatedAt: '2026-08-03 09:00:00', qtyCtnDO: 100, qtyCtnSI: 100 }); // 1200 pcs, processed first
    const calc = run([later, earlier], { allocations });
    const byRow = new Map(calc.previewResults.map((r) => [r.excelRowNumber, r]));
    assert.deepEqual(byRow.get(earlier.excelRowNumber).allocations.map((a) => [a.allocationId, a.qtyPcs]), [[1, 1200]]);
    assert.deepEqual(byRow.get(later.excelRowNumber).allocations.map((a) => [a.allocationId, a.qtyPcs]), [[1, 300], [2, 900]]);
    // child qty in ctn is derived from pcs
    assert.deepEqual(byRow.get(later.excelRowNumber).allocations.map((a) => a.qtyCtn), [25, 75]);
});

test('Calculator: allocation problems go to Rows to Fix and consume nothing', () => {
    const allocations = [allocationRow(1, 1, '044/PO/CRMI/2025', 1000, '2026-08-05 10:00:00')];
    const tooEarly = row({ doCreatedAt: '2026-08-03 08:00:00', qtyCtnDO: 10, qtyCtnSI: 10 });
    const tooMuch = row({ doCreatedAt: '2026-08-06 08:00:00', qtyCtnDO: 100, qtyCtnSI: 100 }); // 1200 > 1000
    const noAllocForPo = row({ customerPoText: '051/PO/CRMI/2026' });
    const ok = row({ doCreatedAt: '2026-08-06 08:00:00', qtyCtnDO: 50, qtyCtnSI: 50 }); // 600
    const calc = run([tooEarly, tooMuch, noAllocForPo, ok], { allocations });
    assert.deepEqual(calc.rowsToFix.map((r) => r.reasonCode), ['NOT_COMPLETED_YET', 'INSUFFICIENT', 'NO_ALLOCATION']);
    assert.equal(calc.summary.validCount, 1);
    assert.equal(calc.previewResults[0].allocations[0].qtyPcs, 600);
});

test('Calculator: capacity already used by saved DOs is respected and never goes negative (returns)', () => {
    const allocations = [
        allocationRow(1, 1, '044/PO/CRMI/2025', 1000, '2026-08-01 10:00:00', 400), // 600 left
        allocationRow(2, 1, '044/PO/CRMI/2025', 500, '2026-08-01 11:00:00', 900) // reduced by a return: 0 left, not -400
    ];
    const calc = run([row({ qtyCtnDO: 50, qtyCtnSI: 50 })], { allocations }); // 600 pcs
    assert.equal(calc.summary.validCount, 1);
    assert.deepEqual(calc.previewResults[0].allocations.map((a) => [a.allocationId, a.qtyPcs]), [[1, 600]]);
    const tooMuch = run([row({ qtyCtnDO: 51, qtyCtnSI: 51 })], { allocations }); // 612 > 600
    assert.equal(tooMuch.rowsToFix[0].reasonCode, 'INSUFFICIENT');
});

test('Calculator: Canceled Invoice rows are counted for the log but not otherwise used', () => {
    const calc = run([row({ canceledInvoice: 'YES' }), row()]);
    assert.equal(calc.summary.canceledInvoiceCount, 1);
    assert.equal(calc.summary.validCount, 2);
});

test('Calculator: older-than-saved-DO is a non-blocking warning', () => {
    const calc = run([row({ doCreatedAt: '2026-08-03 08:00:00' })], { latestSavedDoAt: '2026-08-10 00:00:00' });
    assert.equal(calc.canSave, true);
    assert.equal(calc.warnings.length, 1);
    assert.equal(calc.warnings[0].type, 'OLDER_THAN_SAVED_DO');
});

// ------------------------------------------------------------------ Fingerprint
test('Fingerprint: stable for the same input, changes when allocation or file changes', () => {
    rowNo = 8;
    const make = () => run([row(), row({ qtyCtnDO: 50, qtyCtnSI: 50 })]);
    const a = computeDocumentFlowFingerprint(make(), 'hash1');
    rowNo = 8;
    const b = computeDocumentFlowFingerprint(make(), 'hash1');
    assert.equal(a, b);
    assert.notEqual(a, computeDocumentFlowFingerprint(make(), 'hash2'));

    rowNo = 8;
    const differentCapacity = run([row(), row({ qtyCtnDO: 50, qtyCtnSI: 50 })], {
        allocations: [
            allocationRow(1, 1, '044/PO/CRMI/2025', 1300, '2026-08-01 10:00:00'),
            allocationRow(2, 1, '044/PO/CRMI/2025', 100000, '2026-08-01 11:00:00')
        ]
    });
    assert.notEqual(a, computeDocumentFlowFingerprint(differentCapacity, 'hash1'));
});

// ------------------------------------------------------------------ date parsing (text formats)
// The Excel library and the production businessError helper are replaced by tiny stubs: only text dates are tested here (serial numbers need real SheetJS).
const Module = require('module');
const originalLoad = Module._load;
Module._load = function (request, ...rest) {
    if (request === '../businessError') return { BusinessError: class BusinessError extends Error {} };
    if (request === 'xlsx') return { SSF: { parse_date_code: () => null }, read: () => ({}), utils: {} };
    return originalLoad.call(this, request, ...rest);
};
const { parseDateValue } = require('../helpers/upload-document-flow/excelParserHelper');
Module._load = originalLoad;

test('date: current export format D-Mon-YY HH:mm:ss', () => {
    assert.deepEqual(parseDateValue('06-Jul-26 09:09:06'), { date: '2026-07-06', time: '09:09:06' });
    assert.deepEqual(parseDateValue('10-Jul-26 13:22:02'), { date: '2026-07-10', time: '13:22:02' });
    assert.deepEqual(parseDateValue('5-AUG-2026 7:05'), { date: '2026-08-05', time: '07:05:00' });
});

test('date: older formats still work, empty and invalid are distinguished', () => {
    assert.deepEqual(parseDateValue('8/3/2026 8:33:02 AM'), { date: '2026-08-03', time: '08:33:02' });
    assert.deepEqual(parseDateValue('2026-08-03 08:33:02'), { date: '2026-08-03', time: '08:33:02' });
    assert.deepEqual(parseDateValue(''), { empty: true });
    assert.deepEqual(parseDateValue('31-Feb-26 10:00:00'), { error: true });
    assert.deepEqual(parseDateValue('06-Xyz-26 10:00:00'), { error: true });
    assert.deepEqual(parseDateValue('06-Jul-26 25:00:00'), { error: true });
});

test('date: DD/MM/YYYY HH:mm:ss (24-hour) is day first, AM/PM is month first, ambiguous slash date is rejected', () => {
    assert.deepEqual(parseDateValue('02/01/2026 08:28:03'), { date: '2026-01-02', time: '08:28:03' });
    assert.deepEqual(parseDateValue('14/01/2024 13:55:05'), { date: '2024-01-14', time: '13:55:05' });
    assert.deepEqual(parseDateValue('12/01/2024 08:46:09'), { date: '2024-01-12', time: '08:46:09' });
    assert.deepEqual(parseDateValue('8/3/2026 9:43:51 AM'), { date: '2026-08-03', time: '09:43:51' });
    assert.deepEqual(parseDateValue('02/01/2026'), { error: true });
    assert.deepEqual(parseDateValue('12/13/2026 10:00:00'), { error: true });
    assert.deepEqual(parseDateValue('31/02/2026 10:00:00'), { error: true });
});

test('date: both export variants of the same moment give the same result', () => {
    assert.deepEqual(parseDateValue('02-Jan-26 14:52:18'), parseDateValue('02/01/2026 14:52:18'));
});
