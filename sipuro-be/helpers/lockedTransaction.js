'use strict';

/**
 * Menjalankan pekerjaan di dalam transaksi database yang diserialkan dengan advisory lock bersama.
 * Dipakai commit upload, edit qty, dan force close: ketiganya mengubah po_lot_allocations dan harus
 * berjalan satu per satu (lintas instance serverless), sehingga tidak ada deadlock antar-proses.
 *
 * Urutan: ambil lock -> READ COMMITTED -> BEGIN -> work(connection) -> COMMIT.
 * Gagal: ROLLBACK, lock dan koneksi selalu dilepas, error asli dilempar ulang.
 */

const { BusinessError } = require('./businessError');
const { COMMIT_LOCK_NAME, COMMIT_LOCK_TIMEOUT_SECONDS } = require('./uploadConfig');

const DEFAULT_BUSY_MESSAGE = 'Another allocation change is being saved. Please try again in a moment.';

// Deadlock / lock wait timeout database dijawab sebagai 409 yang ramah, bukan 500.
const translateLockError = (error) => {
    if (error && (error.code === 'ER_LOCK_DEADLOCK' || error.code === 'ER_LOCK_WAIT_TIMEOUT')) {
        return new BusinessError('The data is being changed by another process. Please try again.', 409);
    }
    return error;
};

const runInLockedTransaction = async (db, work, { busyMessage = DEFAULT_BUSY_MESSAGE } = {}) => {
    let connection = null;
    let lockAcquired = false;
    let inTransaction = false;

    try {
        connection = await db.getConnection();

        const [[lockRow]] = await connection.query('SELECT GET_LOCK(?, ?) AS acquired', [
            COMMIT_LOCK_NAME,
            COMMIT_LOCK_TIMEOUT_SECONDS
        ]);
        if (!lockRow || Number(lockRow.acquired) !== 1) {
            throw new BusinessError(busyMessage, 409);
        }
        lockAcquired = true;

        // READ COMMITTED: setelah baris dikunci, pembacaan berikutnya selalu melihat data terbaru
        await connection.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
        await connection.beginTransaction();
        inTransaction = true;

        const result = await work(connection);

        await connection.commit();
        inTransaction = false;
        return result;
    } catch (error) {
        if (connection && inTransaction) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error('Rollback failed:', rollbackError);
            }
        }
        throw translateLockError(error);
    } finally {
        if (connection) {
            if (lockAcquired) {
                try {
                    await connection.query('SELECT RELEASE_LOCK(?)', [COMMIT_LOCK_NAME]);
                } catch (releaseError) {
                    console.error('Release lock failed:', releaseError);
                }
            }
            connection.release();
        }
    }
};

module.exports = { runInLockedTransaction };
