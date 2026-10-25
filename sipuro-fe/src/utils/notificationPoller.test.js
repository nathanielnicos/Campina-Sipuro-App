import { createNotificationPoller, POLL_INTERVAL_MS } from './notificationPoller';

const build = (over = {}) => {
    const log = { counts: [], news: [], refreshes: 0, errors: [], intervals: [], cleared: [] };
    const state = { count: 0, latest: { id: 1 }, hidden: false, open: false, announce: true };
    const poller = createNotificationPoller({
        fetchUnreadCount: async () => state.count,
        fetchLatest: async () => state.latest,
        refreshOpenList: async () => { log.refreshes += 1; },
        onCount: (c) => log.counts.push(c),
        onNew: (n) => log.news.push(n),
        canAnnounce: () => state.announce,
        isListOpenOnFirstPage: () => state.open,
        isHidden: () => state.hidden,
        onError: (e) => log.errors.push(e),
        setIntervalFn: (fn, ms) => { log.intervals.push(ms); return 7; },
        clearIntervalFn: (t) => log.cleared.push(t),
        ...over
    });
    return { poller, log, state };
};

describe('notificationPoller', () => {
    test('poll pertama mengumumkan notifikasi yang belum dibaca; jumlah sama tidak mengumumkan lagi', async () => {
        const { poller, log, state } = build();
        state.count = 3;
        await poller.poll();
        expect(log.news).toEqual([{ id: 1 }]);
        expect(log.counts).toEqual([3]);

        await poller.poll();
        expect(log.news).toEqual([{ id: 1 }]);
        expect(log.counts).toEqual([3, 3]);
    });

    test('jumlah naik mengumumkan; jumlah turun tidak', async () => {
        const { poller, log, state } = build();
        state.count = 2; await poller.poll();
        state.latest = { id: 2 }; state.count = 3; await poller.poll();
        state.count = 1; await poller.poll();
        expect(log.news).toEqual([{ id: 1 }, { id: 2 }]);
        expect(log.counts).toEqual([2, 3, 1]);
    });

    test('jumlah yang diubah lokal dipakai sebagai pembanding', async () => {
        const { poller, log, state } = build();
        state.count = 5; await poller.poll();
        poller.setCount(4); // pengguna menandai satu notifikasi dibaca
        state.count = 4; await poller.poll();
        expect(log.news.length).toBe(1);
        state.count = 5; await poller.poll();
        expect(log.news.length).toBe(2);
    });

    test('tanpa penerima banner, data terbaru tidak diambil', async () => {
        const { poller, log, state } = build();
        state.announce = false; state.count = 2;
        await poller.poll();
        expect(log.news).toEqual([]);
        expect(log.counts).toEqual([2]);
    });

    test('tab tersembunyi tidak di-poll', async () => {
        const { poller, log, state } = build();
        state.hidden = true; state.count = 2;
        await poller.poll();
        expect(log.counts).toEqual([]);
    });

    test('daftar yang terbuka di halaman 1 dimuat ulang; yang tertutup tidak', async () => {
        const { poller, log, state } = build();
        await poller.poll();
        expect(log.refreshes).toBe(0);
        state.open = true;
        await poller.poll();
        expect(log.refreshes).toBe(1);
    });

    test('respons lama yang terlambat diabaikan', async () => {
        let release;
        const slow = new Promise((resolve) => { release = resolve; });
        let calls = 0;
        const { poller, log } = build({
            fetchUnreadCount: async () => {
                calls += 1;
                if (calls === 1) { await slow; return 9; }
                return 2;
            }
        });
        const first = poller.poll();
        await poller.poll();   // poll kedua selesai lebih dulu dengan 2
        release();
        await first;           // poll pertama (9) sudah basi
        expect(log.counts).toEqual([2]);
    });

    test('start poll langsung dan memasang interval 60 detik; stop membersihkan dan mengabaikan respons', async () => {
        let release;
        const gate = new Promise((resolve) => { release = resolve; });
        const { poller, log } = build({ fetchUnreadCount: async () => { await gate; return 4; } });
        poller.start();
        expect(log.intervals).toEqual([POLL_INTERVAL_MS]);
        poller.stop();
        expect(log.cleared).toEqual([7]);
        release();
        await Promise.resolve();
        await Promise.resolve();
        expect(log.counts).toEqual([]);
    });

    test('error tidak dilempar dan jumlah lama dipertahankan', async () => {
        let fail = true;
        const { poller, log } = build({
            fetchUnreadCount: async () => { if (fail) throw new Error('network'); return 1; }
        });
        await poller.poll();
        expect(log.errors.length).toBe(1);
        expect(log.counts).toEqual([]);
        fail = false;
        await poller.poll();
        expect(log.counts).toEqual([1]);
    });
});
