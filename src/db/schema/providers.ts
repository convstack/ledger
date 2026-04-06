import { boolean, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const ledgerProvider = pgTable("ledger_provider", {
	id: text("id").primaryKey(),
	type: text("type").notNull(), // "stripe", "manual"
	name: text("name").notNull(),
	active: boolean("active").notNull().default(false),
	settings: text("settings"), // AES-256-GCM encrypted JSON
	capabilities: jsonb("capabilities").$type<{
		invoices: boolean;
		subscriptions: boolean;
		checkout: boolean;
		refunds: boolean;
		recurringLedger: boolean;
	}>(),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
