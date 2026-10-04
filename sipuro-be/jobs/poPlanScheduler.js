const cron = require('node-cron');
const { sipuroDb } = require('../config/db');
const { getWibDate } = require('../helpers/dateHelper');
const { getWeekInfoFromDate, generateWeekRange } = require('../helpers/weekHelper');
const { createNotification } = require('../helpers/notificationHelper');

/**
 * Core Logic: Evaluate Outstanding PO vs Production Plan for the next 4 months (17 weeks)
 * Grouped per CUSTOMER so each customer receives an isolated summary email.
 */
async function checkPoVsProductionPlan() {
    console.log('[Scheduler] Running PO vs Production Plan evaluation per Customer...');
    try {
        // 1. Get 17 rolling weeks (current week + 16 weeks ahead = ~4 months)
        const todayWib = getWibDate();
        const currentWeekInfo = getWeekInfoFromDate(todayWib);
        const weekList = generateWeekRange(currentWeekInfo.week_number, currentWeekInfo.year, 17);
        const formattedWeekKeys = weekList.map(w => `${w.year}-${String(w.week_number).padStart(2, '0')}`);

        // 2. Query Outstanding PO per Customer and Production Plan summary
        // Disesuaikan: Hanya mengambil item po_details yang berstatus 'Active'
        const query = `
            SELECT 
                h.customer_id,
                p.id_product,
                p.product_code,
                p.product_name,
                IFNULL(po_summary.total_po_outstanding, 0) AS po_outstanding_qty,
                IFNULL(plan_summary.total_plan_qty, 0) AS total_production_plan_qty
            FROM sipuro_db.products p
            INNER JOIN (
                SELECT 
                    d.id_product,
                    h_inner.customer_id,
                    SUM(GREATEST(0, d.base_qty - d.fulfilled_qty)) AS total_po_outstanding
                FROM sipuro_db.po_details d
                JOIN sipuro_db.po_headers h_inner ON d.po_header_id = h_inner.po_header_id
                WHERE d.deleted_at IS NULL
                  AND d.status = 'Active'
                  AND h_inner.status = 'Approved'
                  AND d.fulfilled_qty < d.base_qty
                GROUP BY d.id_product, h_inner.customer_id
            ) po_summary ON p.id_product = po_summary.id_product
            JOIN sipuro_db.po_headers h ON h.customer_id = po_summary.customer_id
            LEFT JOIN (
                SELECT 
                    pp.id_product,
                    SUM(ppi.qty) AS total_plan_qty
                FROM sipuro_db.production_plans pp
                JOIN sipuro_db.production_plan_revisions ppr ON pp.id_plan = ppr.id_plan
                JOIN sipuro_db.production_plan_items ppi ON ppr.id_revision = ppi.id_revision
                WHERE ppr.revision_type = 'CAMPINA_PLAN'
                  AND CONCAT(ppi.year, '-', LPAD(ppi.week_number, 2, '0')) IN (?)
                GROUP BY pp.id_product
            ) plan_summary ON p.id_product = plan_summary.id_product
            WHERE p.is_active = 1 AND po_summary.total_po_outstanding > 0
            GROUP BY h.customer_id, p.id_product, p.product_code, p.product_name, po_summary.total_po_outstanding, plan_summary.total_plan_qty;
        `;

        const queryParams = [formattedWeekKeys.length > 0 ? formattedWeekKeys : ['']];
        const [rows] = await sipuroDb.query(query, queryParams);

        // 3. Group products with issues by customer_id
        const customerIssuesMap = {};

        for (const row of rows) {
            const customerId = row.customer_id;
            const poOutstanding = Number(row.po_outstanding_qty) || 0;
            const totalPlan = Number(row.total_production_plan_qty) || 0;

            let issueStatus = null;
            let shortage = 0;

            if (totalPlan === 0) {
                issueStatus = 'No Plan';
                shortage = poOutstanding;
            } else if (totalPlan < poOutstanding) {
                issueStatus = 'Deficit';
                shortage = poOutstanding - totalPlan;
            }

            if (issueStatus) {
                if (!customerIssuesMap[customerId]) {
                    customerIssuesMap[customerId] = [];
                }

                customerIssuesMap[customerId].push({
                    code: row.product_code,
                    name: row.product_name,
                    poQty: poOutstanding,
                    planQty: totalPlan,
                    shortage: shortage,
                    status: issueStatus
                });
            }
        }

        const customerIds = Object.keys(customerIssuesMap);
        let sentEmailCount = 0;

        // 4. Send isolated notification/email to EACH Customer
        for (const customerId of customerIds) {
            const issueItems = customerIssuesMap[customerId];
            if (issueItems.length === 0) continue;

            const summaryTitle = `Weekly Summary: ${issueItems.length} Product(s) Production Plan Review`;

            // Plain text message khusus untuk tampilan Lonceng Notifikasi Web Application
            const webMessage = `Production plan coverage summary for your active Purchase Orders over the next 4 months is ready (${issueItems.length} product(s) require review). Please check your email for the detailed breakdown.`;

            // Build HTML Table untuk isi email
            let tableRowsHtml = '';
            for (const item of issueItems) {
                const statusBadge = item.status === 'No Plan'
                    ? `<span style="background-color: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 11px;">NO PLAN</span>`
                    : `<span style="background-color: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 11px;">DEFICIT</span>`;

                tableRowsHtml += `
                    <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 10px; font-size: 13px; font-weight: 600; color: #111827;">${item.code}</td>
                        <td style="padding: 10px; font-size: 13px; color: #374151;">${item.name}</td>
                        <td style="padding: 10px; font-size: 13px; text-align: right; color: #111827;">${item.poQty.toLocaleString()}</td>
                        <td style="padding: 10px; font-size: 13px; text-align: right; color: #111827;">${item.planQty.toLocaleString()}</td>
                        <td style="padding: 10px; font-size: 13px; text-align: right; color: #dc2626; font-weight: 600;">${item.shortage.toLocaleString()}</td>
                        <td style="padding: 10px; font-size: 13px; text-align: center;">${statusBadge}</td>
                    </tr>
                `;
            }

            const htmlMessage = `
                <p style="font-size: 14px; color: #374151; margin-bottom: 16px;">
                    Dear Customer, here is the production plan coverage summary for your active Purchase Orders over the next 4 months:
                </p>
                <table style="width: 100%; border-collapse: collapse; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; margin-bottom: 20px;">
                    <thead>
                        <tr style="background-color: #f9fafb; border-bottom: 2px solid #e5e7eb; text-align: left; font-size: 12px; color: #4b5563; text-transform: uppercase; letter-spacing: 0.05em;">
                            <th style="padding: 10px;">Product Code</th>
                            <th style="padding: 10px;">Product Name</th>
                            <th style="padding: 10px; text-align: right;">PO Outstanding</th>
                            <th style="padding: 10px; text-align: right;">Plan Qty</th>
                            <th style="padding: 10px; text-align: right;">Shortage</th>
                            <th style="padding: 10px; text-align: center;">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRowsHtml}
                    </tbody>
                </table>
            `;

            // Kirim notifikasi dengan memisahkan teks web dan pesan HTML email
            await createNotification({
                title: summaryTitle,
                message: webMessage, // Teks singkat rapi di Web UI
                htmlMessage: htmlMessage, // HTML tabel rapi di Email
                recipientType: 'CUSTOMER',
                recipientId: Number(customerId),
                senderType: 'SYSTEM',
                link: null
            });

            sentEmailCount++;
        }

        console.log(`[Scheduler] Evaluation completed. ${sentEmailCount} isolated emails sent to customers.`);
        return {
            success: true,
            totalCustomersNotified: sentEmailCount
        };

    } catch (error) {
        console.error('[Scheduler] Error evaluating PO vs Production Plan:', error);
        throw error;
    }
}

/**
 * Initialize Cron Job: Every Monday at 07:00 AM WIB
 * '0 7 * * 1' -> At 07:00 AM on Monday
 */
function initPoPlanScheduler() {
    cron.schedule('0 7 * * 1', async () => {
        console.log('[Scheduler] Triggering scheduled PO vs Plan check...');
        await checkPoVsProductionPlan();
    }, {
        scheduled: true,
        timezone: "Asia/Jakarta" // WIB Timezone
    });
    console.log('[Scheduler] PO vs Production Plan scheduler initialized (Mondays at 07:00 WIB).');
}

module.exports = {
    initPoPlanScheduler,
    checkPoVsProductionPlan
};
