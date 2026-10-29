'use strict';

/**
 * Keluarga produk: kumpulan produk yang sebenarnya sama (kode lama dan kode penggantinya).
 * Dua produk sekeluarga jika terhubung oleh rantai pemetaan (arah diabaikan): A->B dan B->C
 * membuat {A, B, C} satu keluarga. Fungsi murni; dipakai pengelolaan pemetaan dan alokasi lot.
 */

/**
 * @param {Array<{id_product_old:number, id_product_new:number}>} pairs
 * @returns {{ familyOf: (idProduct:number) => number[], sameFamily: (a:number, b:number) => boolean,
 *   ancestorsOf: (idProduct:number) => number[] }}
 *   familyOf: anggota keluarga (urut naik, termasuk produk itu sendiri); produk tanpa pemetaan = [id].
 *   ancestorsOf: seluruh kode LAMA produk itu menurut arah pemetaan (lama -> baru), bertingkat:
 *   pada A->B->C, leluhur C adalah [A, B]. Tidak termasuk produk itu sendiri; urut naik.
 */
const buildFamilyIndex = (pairs = []) => {
    const parent = new Map();
    const find = (x) => {
        if (!parent.has(x)) parent.set(x, x);
        let root = x;
        while (parent.get(root) !== root) root = parent.get(root);
        // kompresi jalur
        let node = x;
        while (parent.get(node) !== root) {
            const next = parent.get(node);
            parent.set(node, root);
            node = next;
        }
        return root;
    };
    const union = (a, b) => {
        const ra = find(a);
        const rb = find(b);
        if (ra !== rb) parent.set(ra, rb);
    };

    const oldsOf = new Map();
    pairs.forEach((p) => {
        const oldId = Number(p.id_product_old);
        const newId = Number(p.id_product_new);
        union(oldId, newId);
        if (!oldsOf.has(newId)) oldsOf.set(newId, new Set());
        oldsOf.get(newId).add(oldId);
    });

    const membersByRoot = new Map();
    [...parent.keys()].forEach((id) => {
        const root = find(id);
        if (!membersByRoot.has(root)) membersByRoot.set(root, []);
        membersByRoot.get(root).push(id);
    });
    membersByRoot.forEach((members) => members.sort((a, b) => a - b));

    const familyOf = (idProduct) => {
        const id = Number(idProduct);
        if (!parent.has(id)) return [id];
        return [...membersByRoot.get(find(id))];
    };
    const sameFamily = (a, b) => Number(a) === Number(b) || familyOf(a).includes(Number(b));

    const ancestorsOf = (idProduct) => {
        const start = Number(idProduct);
        const seen = new Set();
        const stack = [start];
        while (stack.length > 0) {
            const current = stack.pop();
            (oldsOf.get(current) || []).forEach((oldId) => {
                if (oldId !== start && !seen.has(oldId)) {
                    seen.add(oldId);
                    stack.push(oldId);
                }
            });
        }
        return [...seen].sort((a, b) => a - b);
    };

    return { familyOf, sameFamily, ancestorsOf };
};

module.exports = { buildFamilyIndex };
