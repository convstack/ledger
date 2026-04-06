import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { invoice } from "./invoices";

export const payment = pgTable("payment", {
	id: text("id").primaryKey(),
	invoiceId: text("invoice_id")
		.notNull()
		.references(() => invoice.id),
	amount: integer("amount").notNull(),
	currency: text("currency").notNull(),
	status: text("status").notNull(), // pending, succeeded, failed, refunded
	provider: text("provider").notNull(),
	providerRef: text("provider_ref"),
	method: text("method"), // card, bank_transfer, cash, custom
	metadata: jsonb("metadata"),
	createdAt: timestamp("created_at").notNull().defaultNow(),
});
