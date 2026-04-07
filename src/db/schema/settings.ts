import {
	boolean,
	integer,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

export const ledgerSettings = pgTable("ledger_settings", {
	id: text("id").primaryKey(), // always "default"
	defaultCurrency: text("default_currency").notNull().default("EUR"),
	allowSelfCancel: boolean("allow_self_cancel").notNull().default(true),
	dataRetentionDays: integer("data_retention_days").notNull().default(2555),
	taxRate: integer("tax_rate").default(0), // basis points (1900 = 19%)
	taxLabel: text("tax_label").default("VAT"),
	smtpHost: text("smtp_host"),
	smtpPort: integer("smtp_port"),
	smtpUser: text("smtp_user"),
	smtpPass: text("smtp_pass"),
	smtpFrom: text("smtp_from"),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
