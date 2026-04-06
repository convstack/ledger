import { db } from "~/db";
import { ledgerSettings } from "~/db/schema";

/**
 * Calculate tax for a subtotal using the configured tax rate.
 * Tax rate is in basis points (e.g. 1900 = 19%).
 * Returns { tax, total } in cents.
 */
export async function calculateTax(subtotal: number): Promise<{
	tax: number;
	total: number;
	taxRate: number;
	taxLabel: string;
}> {
	const { eq } = await import("drizzle-orm");

	const [settings] = await db
		.select({
			taxRate: ledgerSettings.taxRate,
			taxLabel: ledgerSettings.taxLabel,
		})
		.from(ledgerSettings)
		.where(eq(ledgerSettings.id, "default"))
		.limit(1);

	const taxRate = settings?.taxRate || 0;
	const taxLabel = settings?.taxLabel || "VAT";

	const tax = Math.round((subtotal * taxRate) / 10000);
	const total = subtotal + tax;

	return { tax, total, taxRate, taxLabel };
}
