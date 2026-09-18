/**
 * Helper untuk perhitungan logika Week berdasarkan standar ISO-8601 Murni UTC.
 */

function getWeekInfoFromDate(dateInput) {
    const d = new Date(dateInput);
    const utcDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

    const dayOfWeek = utcDate.getUTCDay() || 7;
    utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayOfWeek);

    const isoYear = utcDate.getUTCFullYear();
    const yearStart = new Date(Date.UTC(isoYear, 0, 1));
    const weekNumber = Math.ceil((((utcDate - yearStart) / 86400000) + 1) / 7);

    const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
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
    const today = new Date();
    const currentWeekInfo = getWeekInfoFromDate(today);
    return generateWeekRange(currentWeekInfo.week_number, currentWeekInfo.year, 9);
}

module.exports = {
    getWeekInfoFromDate,
    getStartDateOfISOWeek,
    generateWeekRange,
    getDefaultRollingWeeks
};
