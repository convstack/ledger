import { boolean, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const webhookSubscriber = pgTable("webhook_subscriber", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	url: text("url").notNull(),
	secret: text("secret").notNull(),
	events: jsonb("events").$type<string[]>().notNull(), // e.g. ["subscription.paid", "subscription.cancelled"]
	active: boolean("active").notNull().default(true),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
