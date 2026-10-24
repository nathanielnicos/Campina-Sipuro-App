'use strict';

const { BusinessError } = require('./businessError');
const { resolveWeekRange } = require('./weekHelper');

const REVISION_TYPES = ['PROPOSED', 'REVISION', 'CAMPINA_PLAN'];
const MAX_REVISIONS = 100;
const MAX_LABEL_LENGTH = 100; // production_plan_revisions.revision_label varchar(100)
const MAX_QTY = 2147483647; // production_plan_items.qty int(11)

const fail = (message) => new BusinessError(message, 400);

const isPositiveInt = (v) => Number.isInteger(v) && v > 0;

const parseQty = (raw) => {
    if (typeof raw === 'number') return Number.isInteger(raw) ? raw : NaN;
    if (typeof raw === 'string' && /^\d{1,10}$/.test(raw)) return parseInt(raw, 10);
    return NaN;
};

const isRealDate = (str) => {
    if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
    const d = new Date(`${str}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === str;
};

const toPositiveInt = (raw) => {
    const n = typeof raw === 'string' && /^\d+$/.test(raw) ? parseInt(raw, 10) : raw;
    return isPositiveInt(n) ? n : null;
};

/**
 * Memeriksa body simpan Production Plan dan mengubahnya menjadi bentuk bersih.
 * Server yang menentukan daftar minggu (dari start_week/end_week); tanggal mulai minggu dari klien diabaikan.
 * Melempar BusinessError(400) jika ada yang tidak valid.
 */
const validateSavePayload = (body) => {
    if (!body || typeof body !== 'object') throw fail('Invalid plan data.');

    const idProduct = toPositiveInt(body.id_product);
    if (!idProduct) throw fail('Invalid product.');

    const range = resolveWeekRange(body.start_week, body.end_week, { clamp: false });
    if (!range.ok) throw fail(range.error);
    const weeks = range.weeks;

    const { revisions } = body;
    if (!Array.isArray(revisions) || revisions.length === 0 || revisions.length > MAX_REVISIONS) {
        throw fail(`Revisions must contain 1 to ${MAX_REVISIONS} rows.`);
    }

    const seenIds = new Set();
    let campinaCount = 0;

    const clean = revisions.map((rev, index) => {
        const row = index + 1;
        if (!rev || typeof rev !== 'object') throw fail(`Revision row ${row} is invalid.`);

        if (!REVISION_TYPES.includes(rev.revision_type)) throw fail(`Revision row ${row} has an invalid type.`);
        if (rev.revision_type === 'CAMPINA_PLAN') campinaCount += 1;

        let idRevision = null;
        if (rev.id_revision !== undefined && rev.id_revision !== null) {
            idRevision = toPositiveInt(rev.id_revision);
            if (!idRevision) throw fail(`Revision row ${row} has an invalid id.`);
            if (seenIds.has(idRevision)) throw fail(`Revision row ${row} is duplicated.`);
            seenIds.add(idRevision);
        }

        const label = typeof rev.revision_label === 'string' ? rev.revision_label.trim() : '';
        if (!label || label.length > MAX_LABEL_LENGTH) {
            throw fail(`Revision row ${row} needs a label of 1 to ${MAX_LABEL_LENGTH} characters.`);
        }

        const date = typeof rev.revision_date === 'string' ? rev.revision_date.slice(0, 10) : '';
        if (!isRealDate(date)) throw fail(`Revision row ${row} has an invalid date.`);

        if (!rev.weeks_data || typeof rev.weeks_data !== 'object' || Array.isArray(rev.weeks_data)) {
            throw fail(`Revision row ${row} has no week data.`);
        }

        const items = weeks.map((w) => {
            const key = `${w.year}_${w.week_number}`;
            const qty = parseQty(rev.weeks_data[key]);
            if (!Number.isInteger(qty) || qty < 0 || qty > MAX_QTY) {
                throw fail(`Revision row ${row}, week ${w.week_number}: quantity must be a whole number of 0 or more.`);
            }
            return { year: w.year, week_number: w.week_number, week_start_date: w.start_date, qty };
        });

        return { idRevision, type: rev.revision_type, label, date, items };
    });

    if (campinaCount !== 1) throw fail("Exactly one Campina's Plan row is required.");

    return { idProduct, weeks, revisions: clean };
};

module.exports = { REVISION_TYPES, MAX_REVISIONS, MAX_LABEL_LENGTH, MAX_QTY, validateSavePayload };
