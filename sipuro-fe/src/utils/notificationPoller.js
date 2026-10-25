// Logika polling notifikasi tanpa React, agar bisa diuji. Hook useNotifications hanya memasangnya.
//
// Aturan:
// - Poll pertama langsung berjalan saat start(), lalu tiap intervalMs. Tidak ada poll tambahan
//   hanya karena data atau callback di layar berubah.
// - Banner "ada notifikasi baru" dipicu jika jumlah belum dibaca naik dibanding nilai terakhir yang diketahui
//   (termasuk saat pertama kali ada yang belum dibaca).
// - Tab yang tersembunyi tidak di-poll; saat tab kembali terlihat, hook memanggil poll().
// - Hanya respons dari poll terakhir yang dipakai; respons lama yang terlambat diabaikan.

export const POLL_INTERVAL_MS = 60000;

export const createNotificationPoller = ({
    fetchUnreadCount,        // async () => number
    fetchLatest,             // async () => notifikasi terbaru (atau undefined)
    refreshOpenList,         // async () => void, memuat ulang halaman 1 daftar yang sedang terbuka
    onCount,                 // (count) => void
    onNew,                   // (notif) => void
    canAnnounce = () => true,
    isListOpenOnFirstPage = () => false,
    isHidden = () => false,
    onError = () => {},
    intervalMs = POLL_INTERVAL_MS,
    setIntervalFn = setInterval,
    clearIntervalFn = clearInterval
}) => {
    let knownCount = 0;
    let requestId = 0;
    let stopped = false;
    let timer = null;

    const isStale = (id) => stopped || id !== requestId;

    const poll = async () => {
        if (stopped || isHidden()) return;
        const id = ++requestId;

        try {
            const currentCount = await fetchUnreadCount();
            if (isStale(id)) return;

            if (currentCount > knownCount && canAnnounce()) {
                const latest = await fetchLatest();
                if (isStale(id)) return;
                onNew(latest);
            }

            knownCount = currentCount;
            onCount(currentCount);

            if (isListOpenOnFirstPage()) {
                await refreshOpenList();
            }
        } catch (error) {
            onError(error);
        }
    };

    return {
        start() {
            stopped = false;
            poll();
            timer = setIntervalFn(poll, intervalMs);
        },
        stop() {
            stopped = true;
            if (timer !== null) clearIntervalFn(timer);
            timer = null;
        },
        poll,
        // Dipanggil saat jumlah diubah lokal (menandai dibaca), agar poll berikutnya tidak menganggapnya naik.
        setCount(count) {
            knownCount = count;
        }
    };
};
