/**
 * FIFO configuration for Document Flow.
 *
 * FIFO_DATE_SQL is the ONE place that decides which date is used for:
 *   1. ordering batches (oldest first), and
 *   2. the rule  "DO creation datetime >= FIFO date".
 *
 * Today it is the production completed date of the batch.
 * When a QC completed date exists, change ONLY this expression, for example:
 *   'COALESCE(b.qc_completed_date, b.actual_completed_date)'   -- column on batches
 *   'COALESCE(pba.qc_completed_date, b.actual_completed_date)' -- column on po_batch_allocations
 *
 * Available table aliases in the loader query: pba (po_batch_allocations), b (batches),
 * pd (po_details), ph (po_headers). This is a constant written by developers, never user input.
 * The expression must return a DATETIME (or NULL when the date is not known yet).
 */
const FIFO_DATE_SQL = 'b.actual_completed_date';

// Allocation statuses that may NOT receive a DO. Everything else (Open, Closed, Force Closed) is eligible.
const EXCLUDED_ALLOCATION_STATUSES = ['Canceled'];

module.exports = { FIFO_DATE_SQL, EXCLUDED_ALLOCATION_STATUSES };
