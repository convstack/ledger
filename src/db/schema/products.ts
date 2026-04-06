import {
	boolean,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

export const product = pgTable("product", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	description: text("description"),
	price: integer("price").notNull(), // cents
	currency: text("currency").notNull().default("EUR"),
	type: text("type").notNull(), // "one-time", "recurring"
	interval: text("interval"), // "month", "year" (for recurring)
	active: boolean("active").notNull().default(true),
	prorateOnChange: boolean("prorate_on_change").notNull().default(false),
	stripeProductId: text("stripe_product_id"),
	stripePriceId: text("stripe_price_id"),
	metadata: jsonb("metadata"),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
