import { getWibDate } from './dateHelper';

// Satu-satunya tempat perhitungan minggu ISO untuk menu Production Schedule (Production Plan & PO Requirement).
// Aturan yang sama dipakai backend (helpers/weekHelper.js).

export const ROLLING_WEEK_SPAN = 9;

const WEEK_VALUE_PATTERN = /^\d{4}-W\d{2}$/;

// ISO week & tahun dari sebuah tanggal, berbasis WIB.
export const getIsoWeekInfo = (dateInput = new Date()) => {
    const dWib = getWibDate(dateInput);
    const d = new Date(Date.UTC(dWib.getFullYear(), dWib.getMonth(), dWib.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return { year: d.getUTCFullYear(), week };
};

// Menggeser minggu secara presisi dan konsisten lintas tahun (ISO-8601).
export const shiftIsoWeek = (year, week, delta) => {
    const simpleThursday = new Date(Date.UTC(year, 0, 4));
    const dayOfWeek = simpleThursday.getUTCDay() || 7;

    const firstMonday = new Date(simpleThursday);
    firstMonday.setUTCDate(simpleThursday.getUTCDate() - (dayOfWeek - 1));

    const targetMonday = new Date(firstMonday);
    targetMonday.setUTCDate(firstMonday.getUTCDate() + (week - 1 + delta) * 7);

    return getIsoWeekInfo(targetMonday);
};

// Format nilai input type="week": "2026-W09".
export const toWeekValue = ({ year, week }) => `${year}-W${String(week).padStart(2, '0')}`;

// Rentang bawaan: minggu ini sampai 8 minggu ke depan (9 minggu).
export const getDefaultWeekRange = (now = new Date()) => {
    const { year, week } = getIsoWeekInfo(now);
    return {
        startWeek: toWeekValue(shiftIsoWeek(year, week, 0)),
        endWeek: toWeekValue(shiftIsoWeek(year, week, ROLLING_WEEK_SPAN - 1))
    };
};

// Valid jika kedua nilai berformat YYYY-Www dan awal tidak melewati akhir.
export const isValidWeekRange = (startWeek, endWeek) => (
    WEEK_VALUE_PATTERN.test(startWeek || '')
    && WEEK_VALUE_PATTERN.test(endWeek || '')
    && startWeek <= endWeek
);
