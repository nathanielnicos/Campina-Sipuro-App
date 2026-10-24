import { setRequiredQty, getRequiredQty, listRequiredItems, toDraftPayload, MAX_REQUIRED_QTY } from './requiredQty';

const p1 = { id_product: 1, product_code: 'B-2', product_name: 'Beta' };
const p2 = { id_product: 2, product_code: 'A-1', product_name: 'Alpha' };

describe('requiredQty', () => {
    test('mengisi qty, membersihkan pemisah ribuan', () => {
        const items = setRequiredQty({}, p1, '1.250');
        expect(getRequiredQty(items, 1)).toBe(1250);
        expect(items[1].product_name).toBe('Beta');
    });

    test('kosong atau 0 menghapus produk, tidak mengubah objek lama', () => {
        const a = setRequiredQty({}, p1, '10');
        const b = setRequiredQty(a, p1, '');
        expect(getRequiredQty(a, 1)).toBe(10);
        expect(getRequiredQty(b, 1)).toBe(0);
        expect(Object.keys(b)).toEqual([]);
        expect(Object.keys(setRequiredQty(a, p1, '0'))).toEqual([]);
    });

    test('hanya angka diterima dan dibatasi 9 digit', () => {
        expect(getRequiredQty(setRequiredQty({}, p1, 'abc'), 1)).toBe(0);
        expect(getRequiredQty(setRequiredQty({}, p1, '12ab3'), 1)).toBe(123);
        expect(getRequiredQty(setRequiredQty({}, p1, '99999999999'), 1)).toBe(MAX_REQUIRED_QTY);
    });

    test('daftar terurut kode produk dan payload hanya id + qty', () => {
        let items = setRequiredQty({}, p1, '5');
        items = setRequiredQty(items, p2, '7');
        const list = listRequiredItems(items);
        expect(list.map((i) => i.product_code)).toEqual(['A-1', 'B-2']);
        expect(toDraftPayload(list)).toEqual([
            { id_product: 2, required_po_qty: 7 },
            { id_product: 1, required_po_qty: 5 }
        ]);
    });

    test('produk tanpa harga aktif tidak bisa ditambahkan, tetapi bisa dihapus bila sudah ada', () => {
        const noPrice = { ...p1, has_active_price: false };
        expect(Object.keys(setRequiredQty({}, noPrice, '10'))).toEqual([]);
        expect(getRequiredQty(setRequiredQty({}, { ...p1, has_active_price: true }, '10'), 1)).toBe(10);

        const existing = setRequiredQty({}, p1, '10');
        expect(Object.keys(setRequiredQty(existing, noPrice, ''))).toEqual([]);
    });

    test('qty produk yang tidak diisi bernilai 0', () => {
        expect(getRequiredQty({}, 99)).toBe(0);
    });
});
