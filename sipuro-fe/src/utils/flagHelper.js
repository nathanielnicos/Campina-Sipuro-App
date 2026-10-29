// Kolom boolean MySQL (TINYINT) bisa tiba sebagai true/false, 1/0, atau '1'/'0'.
export const isFlagOn = (value) => value === true || value === 1 || value === '1';
