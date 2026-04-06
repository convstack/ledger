import { boolean, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { product } from "./products";
import { ledgerProvider } from "./providers";

export const subscription = pgTable("subscription", {
	id: text("id").primaryKey(),
	userId: text("user_id").notNull(),
	productId: text("product_id")
		.notNull()
		.references(() => product.id),
	status: text("status").notNull(), // active, cancelled, past_due, paused
	providerId: text("provider_id").references(() => ledgerProvider.id),
	providerRef: text("provider_ref"),
	currentPeriodStart: timestamp("current_period_start"),
	currentPeriodEnd: timestamp("current_period_end"),
	cancelledAt: timestamp("cancelled_at"),
	cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
	metadata: jsonb("metadata"),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
