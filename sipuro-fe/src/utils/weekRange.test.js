import { getIsoWeekInfo, shiftIsoWeek, toWeekValue, getDefaultWeekRange, isValidWeekRange } from './weekRange';

describe('weekRange', () => {
    test('getIsoWeekInfo mengikuti ISO-8601 (awal dan akhir tahun)', () => {
        expect(getIsoWeekInfo(new Date('2026-01-01T05:00:00Z'))).toEqual({ year: 2026, week: 1 });
        expect(getIsoWeekInfo(new Date('2026-12-31T05:00:00Z'))).toEqual({ year: 2026, week: 53 });
        expect(getIsoWeekInfo(new Date('2027-01-03T05:00:00Z'))).toEqual({ year: 2026, week: 53 });
        expect(getIsoWeekInfo(new Date('2027-01-04T05:00:00Z'))).toEqual({ year: 2027, week: 1 });
    });

    test('shiftIsoWeek melintasi tahun', () => {
        expect(shiftIsoWeek(2026, 52, 1)).toEqual({ year: 2026, week: 53 });
        expect(shiftIsoWeek(2026, 52, 2)).toEqual({ year: 2027, week: 1 });
        expect(shiftIsoWeek(2027, 1, -1)).toEqual({ year: 2026, week: 53 });
    });

    test('toWeekValue memberi nol di depan', () => {
        expect(toWeekValue({ year: 2026, week: 9 })).toBe('2026-W09');
    });

    test('getDefaultWeekRange = 9 minggu mulai minggu ini', () => {
        expect(getDefaultWeekRange(new Date('2026-10-21T05:00:00Z'))).toEqual({ startWeek: '2026-W43', endWeek: '2026-W51' });
        expect(getDefaultWeekRange(new Date('2026-12-30T05:00:00Z'))).toEqual({ startWeek: '2026-W53', endWeek: '2027-W08' });
    });

    test('isValidWeekRange', () => {
        expect(isValidWeekRange('2026-W10', '2026-W10')).toBe(true);
        expect(isValidWeekRange('2026-W52', '2027-W02')).toBe(true);
        expect(isValidWeekRange('2026-W11', '2026-W10')).toBe(false);
        expect(isValidWeekRange('', '2026-W10')).toBe(false);
        expect(isValidWeekRange('2026-W10', undefined)).toBe(false);
        expect(isValidWeekRange('2026-W9', '2026-W10')).toBe(false);
    });
});
