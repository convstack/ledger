import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { ledgerProvider } from "./providers";

export const invoice = pgTable("invoice", {
	id: text("id").primaryKey(),
	invoiceNumber: text("invoice_number").unique(), // INV-2026-0001
	userId: text("user_id").notNull(),
	status: text("status").notNull().default("draft"),
	currency: text("currency").notNull().default("EUR"),
	subtotal: integer("subtotal").notNull(),
	tax: integer("tax").notNull().default(0),
	total: integer("total").notNull(),
	providerId: text("provider_id").references(() => ledgerProvider.id),
	providerRef: text("provider_ref"),
	dueDate: timestamp("due_date"),
	paidAt: timestamp("paid_at"),
	paymentInstructions: text("payment_instructions"),
	createdBy: text("created_by").notNull(),
	notes: text("notes"),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const invoiceItem = pgTable("invoice_item", {
	id: text("id").primaryKey(),
	invoiceId: text("invoice_id")
		.notNull()
		.references(() => invoice.id, { onDelete: "cascade" }),
	description: text("description").notNull(),
	quantity: integer("quantity").notNull().default(1),
	unitPrice: integer("unit_price").notNull(),
	total: integer("total").notNull(),
	productId: text("product_id"),
	createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const invoiceCounter = pgTable("invoice_counter", {
	year: integer("year").primaryKey(),
	lastNumber: integer("last_number").notNull().default(0),
});
