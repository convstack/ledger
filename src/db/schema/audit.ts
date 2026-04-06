import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const ledgerAuditLog = pgTable("ledger_audit_log", {
	id: text("id").primaryKey(),
	action: text("action").notNull(), // e.g. "invoice.created", "payment.succeeded"
	entityType: text("entity_type").notNull(), // "invoice", "payment", "provider", "subscription"
	entityId: text("entity_id").notNull(),
	userId: text("user_id"),
	details: jsonb("details"),
	createdAt: timestamp("created_at").notNull().defaultNow(),
});
