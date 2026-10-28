/**
 * Utilitas generik untuk mengunduh berkas dari respons API (axios dengan responseType 'blob').
 */

const FILENAME_PATTERN = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;

const getFilenameFromDisposition = (disposition, fallbackName) => {
    if (!disposition || !disposition.includes('filename=')) return fallbackName;
    const matches = FILENAME_PATTERN.exec(disposition);
    const name = matches && matches[1] ? matches[1].replace(/['"]/g, '').trim() : '';
    return name || fallbackName;
};

/**
 * Menyimpan isi respons sebagai berkas unduhan. Nama berkas dari header Content-Disposition,
 * atau fallbackName bila header tidak ada.
 */
export const saveBlobResponse = (response, fallbackName) => {
    const filename = getFilenameFromDisposition(response.headers['content-disposition'], fallbackName);
    const blob = new Blob([response.data], {
        type: response.headers['content-type'] || 'application/octet-stream'
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
};

/**
 * Pesan error dari respons berjenis blob. Saat responseType 'blob', body error JSON dari server
 * juga berupa Blob, sehingga perlu dibaca dulu agar pesan aslinya (mis. filter tidak valid) tampil.
 */
export const readBlobErrorMessage = async (error, fallbackMessage) => {
    const data = error && error.response ? error.response.data : null;
    if (data instanceof Blob) {
        try {
            const parsed = JSON.parse(await data.text());
            if (parsed && typeof parsed.message === 'string' && parsed.message) return parsed.message;
        } catch (parseError) {
            // isi bukan JSON: pakai pesan cadangan
        }
    }
    return fallbackMessage;
};
