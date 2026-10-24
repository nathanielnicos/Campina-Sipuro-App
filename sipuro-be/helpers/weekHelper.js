const { getWibDate } = require('./dateHelper');

/**
 * Helper untuk perhitungan logika Week berdasarkan standar ISO-8601 Murni.
 */

function getWeekInfoFromDate(dateInput) {
    const d = getWibDate(dateInput);
    const utcDate = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));

    const dayOfWeek = utcDate.getUTCDay() || 7;
    utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayOfWeek);

    const isoYear = utcDate.getUTCFullYear();
    const yearStart = new Date(Date.UTC(isoYear, 0, 1));
    const weekNumber = Math.ceil((((utcDate - yearStart) / 86400000) + 1) / 7);

    const monday = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    monday.setUTCDate(monday.getUTCDate() - (dayOfWeek - 1));

    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);

    const formatDateStr = (dateObj) => {
        const year = dateObj.getUTCFullYear();
        const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    return {
        week_number: weekNumber,
        year: isoYear,
        start_date: formatDateStr(monday),
        end_date: formatDateStr(sunday)
    };
}

function getStartDateOfISOWeek(weekNo, year) {
    const simpleThursday = new Date(Date.UTC(year, 0, 4));
    const dayOfWeek = simpleThursday.getUTCDay() || 7;

    const firstMonday = new Date(simpleThursday);
    firstMonday.setUTCDate(simpleThursday.getUTCDate() - (dayOfWeek - 1));

    const targetMonday = new Date(firstMonday);
    targetMonday.setUTCDate(firstMonday.getUTCDate() + (weekNo - 1) * 7);

    return targetMonday;
}

function generateWeekRange(startWeekNo, startYear, totalCount) {
    const list = [];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    let currentStartDate = getStartDateOfISOWeek(startWeekNo, startYear);

    for (let i = 0; i < totalCount; i++) {
        const weekInfo = getWeekInfoFromDate(currentStartDate);

        const endDate = new Date(currentStartDate);
        endDate.setUTCDate(currentStartDate.getUTCDate() + 6);

        const day = currentStartDate.getUTCDate();
        const monthStr = months[currentStartDate.getUTCMonth()];
        const yearStr = currentStartDate.getUTCFullYear();
        const dateFormattedLabel = `${day} ${monthStr} ${yearStr}`;

        const formatDateStr = (d) => {
            const y = d.getUTCFullYear();
            const m = String(d.getUTCMonth() + 1).padStart(2, '0');
            const dayNum = String(d.getUTCDate()).padStart(2, '0');
            return `${y}-${m}-${dayNum}`;
        };

        list.push({
            week_number: weekInfo.week_number,
            year: weekInfo.year,
            start_date: formatDateStr(currentStartDate),
            week_start_date: formatDateStr(currentStartDate),
            end_date: formatDateStr(endDate),
            date_label: dateFormattedLabel
        });

        currentStartDate.setUTCDate(currentStartDate.getUTCDate() + 7);
    }

    return list;
}

function getDefaultRollingWeeks() {
    // Menggunakan WIB Date untuk penentuan tanggal hari ini
    const today = getWibDate();
    const currentWeekInfo = getWeekInfoFromDate(today);
    return generateWeekRange(currentWeekInfo.week_number, currentWeekInfo.year, 9);
}

const MAX_WEEK_SPAN = 104;

/**
 * Mengurai "YYYY-Www" (nilai input type="week") menjadi { year, week }.
 * Ketat: harus tepat 4 digit tahun dan 2 digit minggu, dan minggu tersebut harus ada di tahun ISO itu.
 */
function parseWeekString(weekStr) {
    if (typeof weekStr !== 'string') return null;
    const match = /^(\d{4})-W(\d{2})$/.exec(weekStr);
    if (!match) return null;
    const year = parseInt(match[1], 10);
    const week = parseInt(match[2], 10);
    if (week < 1 || week > 53) return null;
    const info = getWeekInfoFromDate(getStartDateOfISOWeek(week, year));
    if (info.year !== year || info.week_number !== week) return null;
    return { year, week };
}

/**
 * Satu-satunya tempat yang menerjemahkan rentang minggu dari UI menjadi daftar minggu.
 * - clamp=false (simpan data): rentang salah / terlalu panjang -> { ok: false, error }.
 * - clamp=true  (tampilan): rentang terlalu panjang dipotong ke MAX_WEEK_SPAN.
 */
function resolveWeekRange(startStr, endStr, { clamp = false } = {}) {
    const start = parseWeekString(startStr);
    const end = parseWeekString(endStr);
    if (!start || !end) {
        return { ok: false, error: 'Invalid week range. Use the format YYYY-Www.' };
    }

    const startDate = getStartDateOfISOWeek(start.week, start.year);
    const endDate = getStartDateOfISOWeek(end.week, end.year);
    if (startDate > endDate) {
        return { ok: false, error: 'Start week must not be after end week.' };
    }

    const count = Math.round((endDate.getTime() - startDate.getTime()) / 86400000 / 7) + 1;
    if (count > MAX_WEEK_SPAN && !clamp) {
        return { ok: false, error: `Week range must not exceed ${MAX_WEEK_SPAN} weeks.` };
    }

    return { ok: true, weeks: generateWeekRange(start.week, start.year, Math.min(count, MAX_WEEK_SPAN)) };
}

// Untuk tampilan: rentang tidak valid jatuh kembali ke rolling default.
function getWeeksListBetween(startStr, endStr) {
    const result = resolveWeekRange(startStr, endStr, { clamp: true });
    return result.ok ? result.weeks : getDefaultRollingWeeks();
}

module.exports = {
    MAX_WEEK_SPAN,
    parseWeekString,
    resolveWeekRange,
    getWeeksListBetween,
    getWeekInfoFromDate,
    getStartDateOfISOWeek,
    generateWeekRange,
    getDefaultRollingWeeks
};
