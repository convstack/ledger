import { nanoid } from "nanoid";
import { db } from "~/db";
import {
	invoice,
	ledgerAuditLog,
	ledgerSettings,
	subscription,
} from "~/db/schema";

const CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Anonymize old invoices and subscriptions based on the configured
 * data retention period. Financial records (amounts, dates, status)
 * are preserved for tax/legal compliance — only personal identifiers
 * are scrubbed.
 */
async function runRetention() {
	const { eq, lt, and, or } = await import("drizzle-orm");

	const [settings] = await db
		.select({ dataRetentionDays: ledgerSettings.dataRetentionDays })
		.from(ledgerSettings)
		.where(eq(ledgerSettings.id, "default"))
		.limit(1);

	if (!settings) return;

	const cutoff = new Date();
	cutoff.setDate(cutoff.getDate() - settings.dataRetentionDays);

	// Anonymize old paid/cancelled invoices
	const oldInvoices = await db
		.select({ id: invoice.id, userId: invoice.userId })
		.from(invoice)
		.where(
			and(
				or(eq(invoice.status, "paid"), eq(invoice.status, "cancelled")),
				lt(invoice.updatedAt, cutoff),
				// Don't re-anonymize already anonymized records
				// userId "[deleted]" means already processed
			),
		)
		.limit(500);

	const toAnonymize = oldInvoices.filter((i) => i.userId !== "[deleted]");

	if (toAnonymize.length > 0) {
		for (const inv of toAnonymize) {
			await db
				.update(invoice)
				.set({
					userId: "[deleted]",
					notes: null,
					paymentInstructions: null,
					updatedAt: new Date(),
				})
				.where(eq(invoice.id, inv.id));
		}

		// Anonymize subscriptions for the same users
		const userIds = [...new Set(toAnonymize.map((i) => i.userId))];
		for (const userId of userIds) {
			await db
				.update(subscription)
				.set({
					userId: "[deleted]",
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(subscription.userId, userId),
						or(
							eq(subscription.status, "cancelled"),
							lt(subscription.updatedAt, cutoff),
						),
					),
				);
		}

		await db.insert(ledgerAuditLog).values({
			id: nanoid(),
			action: "data_retention.anonymized",
			entityType: "invoice",
			entityId: "batch",
			userId: "system",
			details: { count: toAnonymize.length },
			createdAt: new Date(),
		});

		console.log(`[data-retention] Anonymized ${toAnonymize.length} records`);
	}
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startDataRetention() {
	if (intervalId) return;
	console.log("Data retention job started (interval: 24h)");
	// Run first check after 1 minute, then every 24 hours
	setTimeout(() => {
		runRetention().catch((err) => console.error("Data retention failed:", err));
		intervalId = setInterval(() => {
			runRetention().catch((err) =>
				console.error("Data retention failed:", err),
			);
		}, CHECK_INTERVAL);
	}, 60_000);
}
