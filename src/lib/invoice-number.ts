import { db } from "~/db";
import { invoiceCounter } from "~/db/schema";

/**
 * Generate the next sequential invoice number for the current year.
 * Format: INV-2026-0001
 */
export async function nextInvoiceNumber(): Promise<string> {
	const { eq, sql } = await import("drizzle-orm");
	const year = new Date().getFullYear();

	// Upsert the counter and increment atomically
	const [row] = await db
		.insert(invoiceCounter)
		.values({ year, lastNumber: 1 })
		.onConflictDoUpdate({
			target: invoiceCounter.year,
			set: { lastNumber: sql`${invoiceCounter.lastNumber} + 1` },
		})
		.returning({ lastNumber: invoiceCounter.lastNumber });

	const num = row.lastNumber.toString().padStart(4, "0");
	return `INV-${year}-${num}`;
}
