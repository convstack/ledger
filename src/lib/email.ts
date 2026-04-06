import { createTransport } from "nodemailer";
import { db } from "~/db";
import { ledgerSettings } from "~/db/schema";

interface EmailOptions {
	to: string;
	subject: string;
	text: string;
	html?: string;
}

async function getSmtpConfig() {
	const { eq } = await import("drizzle-orm");

	const [settings] = await db
		.select({
			smtpHost: ledgerSettings.smtpHost,
			smtpPort: ledgerSettings.smtpPort,
			smtpUser: ledgerSettings.smtpUser,
			smtpPass: ledgerSettings.smtpPass,
			smtpFrom: ledgerSettings.smtpFrom,
		})
		.from(ledgerSettings)
		.where(eq(ledgerSettings.id, "default"))
		.limit(1);

	if (!settings?.smtpHost || !settings.smtpFrom) return null;
	return settings;
}

/**
 * Send an email using the configured SMTP settings.
 * Returns true if sent, false if SMTP is not configured.
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
	const config = await getSmtpConfig();
	if (!config) return false;

	try {
		const transport = createTransport({
			host: config.smtpHost!,
			port: config.smtpPort || 587,
			auth:
				config.smtpUser && config.smtpPass
					? { user: config.smtpUser, pass: config.smtpPass }
					: undefined,
		});

		await transport.sendMail({
			from: config.smtpFrom!,
			to: options.to,
			subject: options.subject,
			text: options.text,
			html: options.html,
		});

		return true;
	} catch (err) {
		console.warn("Failed to send email:", err);
		return false;
	}
}

/**
 * Resolve a user's email from Lanyard.
 */
export async function getUserEmail(userId: string): Promise<string | null> {
	const lanyardUrl = process.env.LANYARD_URL || "http://localhost:3000";
	const serviceKey = process.env.LANYARD_SERVICE_KEY;
	if (!serviceKey) return null;

	try {
		const res = await fetch(`${lanyardUrl}/api/users/${userId}`, {
			headers: { Authorization: `ServiceKey ${serviceKey}` },
		});
		if (!res.ok) return null;
		const data = await res.json();
		return data.email || null;
	} catch {
		return null;
	}
}
