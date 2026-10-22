const { BusinessError } = require('../businessError');

const calculateDeliveryOrderFifo = (
    rawRows = [],
    existingHashes = [],
    openLotAllocations = [],
    allProducts = []
) => {
    const hashSet = new Set(existingHashes);
    const productByCode = new Map(allProducts.map((p) => [p.product_code, p]));

    const categorizedDetails = {
        newRows: [],
        duplicateRows: [],
        nonGoodRows: [],
        unregisteredRows: [],
        unallocatedRows: []
    };

    // State Alokasi PO Lot yang dapat dikirim (Track remaining deliverable)
    // Sisa kuota per po_lot_allocation_id = allocated_qty - (sudah dialokasi ke DO sebelumnya)
    const allocPool = new Map();
    openLotAllocations.forEach((a) => {
        // Sisa yang benar-benar bisa dikirim = Alokasi Lot - Yang Sudah Dikirim Sebelumnya
        const allocated = Number(a.allocated_qty) || 0;
        const alreadyDelivered = Number(a.already_delivered_qty) || 0;
        const remainingDeliverable = Math.max(0, allocated - alreadyDelivered);

        allocPool.set(a.po_lot_allocation_id, {
            ...a,
            availableToDeliver: remainingDeliverable
        });
    });

    const groups = new Map(); // Key: `${shipmentNum}_${itemCode}_${lotNumber}`

    rawRows.forEach((row, index) => {
        const isRegistered = productByCode.has(row.itemCode);
        const isDuplicate = hashSet.has(row.rowHash);
        const isGood = row.lotStatus && row.lotStatus.toUpperCase() === 'GOOD';

        if (!isRegistered) {
            row.rowStatusCategory = 'UNREGISTERED';
            categorizedDetails.unregisteredRows.push(row);
        } else if (isDuplicate) {
            row.rowStatusCategory = 'DUPLICATE';
            categorizedDetails.duplicateRows.push(row);
        } else if (!isGood) {
            row.rowStatusCategory = 'NON_GOOD';
            categorizedDetails.nonGoodRows.push(row);
        } else {
            row.rowStatusCategory = 'NEW';
            categorizedDetails.newRows.push(row);

            const key = `${row.shipmentNum}\u0000${row.itemCode}\u0000${row.lotNumber}`;
            let group = groups.get(key);
            if (!group) {
                group = {
                    key,
                    shipmentNum: row.shipmentNum,
                    itemCode: row.itemCode,
                    lotNumber: row.lotNumber,
                    transDate: row.transDate,
                    totalQty: 0,
                    rows: [],
                    firstIndex: index
                };
                groups.set(key, group);
            }
            group.rows.push(row);
            group.totalQty += Number(row.qtyToProcess) || 0;
        }
    });

    const allocatedDoGroups = [];
    const unallocatedDoGroups = [];

    // Alokasi FIFO per DO + Item + Lot
    groups.forEach((group) => {
        if (group.totalQty <= 0) {
            unallocatedDoGroups.push({ group, reason: 'Net quantity is zero or negative.' });
            return;
        }

        // Cari candidates alokasi po_lot_allocations yang sesuai lot dan item
        const candidates = [...allocPool.values()].filter(
            (a) => a.product_code === group.itemCode && a.lot_number === group.lotNumber && a.availableToDeliver > 0
        );

        const totalAvailable = candidates.reduce((sum, c) => sum + c.availableToDeliver, 0);
        if (totalAvailable < group.totalQty) {
            unallocatedDoGroups.push({
                group,
                reason: `Insufficient allocated PO lot quantity (Available: ${totalAvailable}, Required: ${group.totalQty}).`
            });
            return;
        }

        let remaining = group.totalQty;
        const doAllocations = [];

        for (const candidate of candidates) {
            if (remaining <= 0) break;
            const take = Math.min(remaining, candidate.availableToDeliver);
            candidate.availableToDeliver -= take;

            doAllocations.push({
                poLotAllocationId: candidate.po_lot_allocation_id,
                poDetailId: candidate.po_detail_id,
                poNumber: candidate.po_number,
                customerPoText: candidate.customer_po_text,
                poCreatedDate: candidate.po_created_date,
                qtyPcs: take
            });

            remaining -= take;
        }

        allocatedDoGroups.push({ group, doAllocations });
    });

    // Masukkan baris yang gagal alokasi ke list unallocated
    unallocatedDoGroups.forEach(({ group, reason }) => {
        group.rows.forEach((r) => {
            categorizedDetails.unallocatedRows.push({ ...r, reason });
        });
    });

    return {
        categorizedDetails,
        allocatedDoGroups,
        canSave: allocatedDoGroups.length > 0,
        summary: {
            totalRows: rawRows.length,
            validRows: categorizedDetails.newRows.length,
            allocatedGroups: allocatedDoGroups.length,
            unallocatedRows: categorizedDetails.unallocatedRows.length,
            duplicateRows: categorizedDetails.duplicateRows.length,
            nonGoodRows: categorizedDetails.nonGoodRows.length,
            unregisteredRows: categorizedDetails.unregisteredRows.length
        }
    };
};

module.exports = {
    calculateDeliveryOrderFifo
};
