const { WIB_OFFSET } = require('./documentFlowConfig');

// MySQL / MariaDB expression that returns an ISO string with the WIB offset, e.g. 2026-08-03T08:33:02+07:00.
// The database stores WIB wall-clock values; the offset lets the frontend (formatDateTime) show the
// correct time in any browser timezone.
const isoDateTimeSql = (column) => `DATE_FORMAT(${column}, '%Y-%m-%dT%H:%i:%s${WIB_OFFSET}')`;
const isoDateSql = (column) => `DATE_FORMAT(${column}, '%Y-%m-%d')`;

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const isDateOnly = (value) => {
    if (typeof value !== 'string' || !DATE_ONLY_REGEX.test(value)) return false;
    const [y, m, d] = value.split('-').map(Number);
    const parsed = new Date(Date.UTC(y, m - 1, d));
    return parsed.getUTCFullYear() === y && parsed.getUTCMonth() === m - 1 && parsed.getUTCDate() === d;
};

// 'YYYY-MM-DD' + 1 day (calendar arithmetic, independent of server timezone)
const nextDay = (value) => {
    const [y, m, d] = value.split('-').map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
};

// Escape LIKE wildcards with "!" (use together with: LIKE ? ESCAPE '!')
const likePattern = (value) => `%${String(value).trim().replace(/[!%_]/g, (ch) => `!${ch}`)}%`;

const parsePagination = (query, { defaultLimit = 10, maxLimit = 100 } = {}) => {
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || defaultLimit, 1), maxLimit);
    return { page, limit, offset: (page - 1) * limit };
};

/**
 * Adds a date-range condition on a DATETIME column (inclusive of the whole "to" day,
 * written so an index on the column can still be used).
 */
const addDateTimeRange = (conditions, params, column, from, to) => {
    if (isDateOnly(from)) {
        conditions.push(`${column} >= ?`);
        params.push(`${from} 00:00:00`);
    }
    if (isDateOnly(to)) {
        conditions.push(`${column} < ?`);
        params.push(`${nextDay(to)} 00:00:00`);
    }
};

// Same for a DATE column
const addDateRange = (conditions, params, column, from, to) => {
    if (isDateOnly(from)) {
        conditions.push(`${column} >= ?`);
        params.push(from);
    }
    if (isDateOnly(to)) {
        conditions.push(`${column} <= ?`);
        params.push(to);
    }
};

module.exports = {
    isoDateTimeSql,
    isoDateSql,
    isDateOnly,
    nextDay,
    likePattern,
    parsePagination,
    addDateTimeRange,
    addDateRange
};
