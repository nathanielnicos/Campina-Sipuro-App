import { formatDate, formatDateTime } from '../../../utils/dateHelper';

// Preview rows carry WIB wall-clock strings ("YYYY-MM-DD HH:mm:ss" / "YYYY-MM-DD").
// They are converted to the same ISO shape the list endpoints return, so the shared formatters behave the same
// in any browser timezone.
export const previewDateTime = (value) => {
    if (!value) return '-';
    const text = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(text)) {
        const withSeconds = text.length === 16 ? `${text}:00` : text;
        return formatDateTime(`${withSeconds.replace(' ', 'T')}+07:00`);
    }
    return formatDateTime(text);
};

export const previewDate = (value) => {
    if (!value) return '-';
    return formatDate(String(value).trim());
};
