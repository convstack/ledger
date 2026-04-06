import { createFileRoute } from "@tanstack/react-router";
import { db } from "~/db";
import { ledgerSettings } from "~/db/schema";
import { getRequestUser, requireLedgerManage } from "~/lib/auth";
import { ensureDefaults } from "~/server/services/init";

export const Route = createFileRoute("/api/settings")({
	server: {
		handlers: {
			GET: async ({ request }: { request: Request }) => {
				const user = getRequestUser(request);
				const err = requireLedgerManage(user);
				if (err) return err;

				await ensureDefaults();

				const { eq } = await import("drizzle-orm");
				const [settings] = await db
					.select()
					.from(ledgerSettings)
					.where(eq(ledgerSettings.id, "default"))
					.limit(1);

				if (!settings) {
					return new Response(JSON.stringify({ error: "Settings not found" }), {
						status: 404,
						headers: { "Content-Type": "application/json" },
					});
				}

				return new Response(
					JSON.stringify({
						fields: [
							{
								key: "defaultCurrency",
								label: "Default Currency",
								value: settings.defaultCurrency,
							},
							{
								key: "taxRate",
								label: "Tax Rate (basis points)",
								value: settings.taxRate,
							},
							{
								key: "taxLabel",
								label: "Tax Label",
								value: settings.taxLabel,
							},
							{
								key: "dataRetentionDays",
								label: "Data Retention (days)",
								value: settings.dataRetentionDays,
							},
							{
								key: "smtpHost",
								label: "SMTP Host",
								value: settings.smtpHost || "",
							},
							{
								key: "smtpPort",
								label: "SMTP Port",
								value: settings.smtpPort || "",
							},
							{
								key: "smtpUser",
								label: "SMTP User",
								value: settings.smtpUser || "",
							},
							{
								key: "smtpPass",
								label: "SMTP Password",
								value: settings.smtpPass ? "********" : "",
							},
							{
								key: "smtpFrom",
								label: "From Address",
								value: settings.smtpFrom || "",
							},
						],
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				);
			},

			PUT: async ({ request }: { request: Request }) => {
				const user = getRequestUser(request);
				const err = requireLedgerManage(user);
				if (err) return err;

				await ensureDefaults();

				let body: Record<string, string>;
				try {
					body = await request.json();
				} catch {
					return new Response(JSON.stringify({ error: "Invalid JSON" }), {
						status: 400,
						headers: { "Content-Type": "application/json" },
					});
				}

				const { eq } = await import("drizzle-orm");

				const updates: Record<string, unknown> = {
					updatedAt: new Date(),
				};
				if (body.defaultCurrency)
					updates.defaultCurrency = body.defaultCurrency;
				if (body.taxRate) updates.taxRate = Number(body.taxRate);
				if (body.taxLabel) updates.taxLabel = body.taxLabel;
				if (body.dataRetentionDays)
					updates.dataRetentionDays = Number(body.dataRetentionDays);
				if (body.smtpHost) updates.smtpHost = body.smtpHost;
				if (body.smtpPort) updates.smtpPort = Number(body.smtpPort);
				if (body.smtpUser) updates.smtpUser = body.smtpUser;
				if (body.smtpPass && !body.smtpPass.startsWith("*"))
					updates.smtpPass = body.smtpPass;
				if (body.smtpFrom) updates.smtpFrom = body.smtpFrom;

				await db
					.update(ledgerSettings)
					.set(updates)
					.where(eq(ledgerSettings.id, "default"));

				return new Response(JSON.stringify({ success: true }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			},
		},
	},
});
