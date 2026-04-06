import { db } from "~/db";
import { ledgerSettings } from "~/db/schema";

export async function ensureDefaults() {
	const { eq } = await import("drizzle-orm");

	const [existing] = await db
		.select({ id: ledgerSettings.id })
		.from(ledgerSettings)
		.where(eq(ledgerSettings.id, "default"))
		.limit(1);

	if (existing) return;

	await db.insert(ledgerSettings).values({
		id: "default",
		defaultCurrency: "EUR",
		dataRetentionDays: 2555,
		taxRate: 0,
		taxLabel: "VAT",
		updatedAt: new Date(),
	});

	console.log("Created default ledger settings");
}
