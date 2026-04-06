import { createFileRoute } from "@tanstack/react-router";
import { db } from "~/db";
import { ledgerProvider } from "~/db/schema";
import { getRequestUser, requireLedgerManage } from "~/lib/auth";
import { decryptSettings, encryptSettings } from "~/lib/crypto";
import { getProviderByType } from "~/lib/providers/registry";

export const Route = createFileRoute("/api/providers/$id")({
	server: {
		handlers: {
			GET: async ({
				request,
				params,
			}: {
				request: Request;
				params: { id: string };
			}) => {
				const user = getRequestUser(request);
				const err = requireLedgerManage(user);
				if (err) return err;

				const { eq } = await import("drizzle-orm");
				const [row] = await db
					.select()
					.from(ledgerProvider)
					.where(eq(ledgerProvider.id, params.id))
					.limit(1);

				if (!row) {
					return new Response(JSON.stringify({ error: "Provider not found" }), {
						status: 404,
						headers: { "Content-Type": "application/json" },
					});
				}

				// Get the settings schema for this provider type
				const provider = getProviderByType(row.type);
				const schema = provider?.getSettingsSchema() ?? [];
				const settings = row.settings ? decryptSettings(row.settings) : {};

				// Mask sensitive fields for display
				const maskedSettings: Record<string, string> = {};
				for (const field of schema) {
					const val = settings[field.key] || "";
					maskedSettings[field.key] =
						field.type === "password" && val
							? `${"*".repeat(Math.min(val.length, 8))}...`
							: val;
				}

				return new Response(
					JSON.stringify({
						fields: [
							{ key: "name", label: "Name", value: row.name },
							{ key: "type", label: "Type", value: row.type },
							{
								key: "active",
								label: "Active",
								value: row.active,
							},
							...schema.map((s) => ({
								key: s.key,
								label: s.label,
								value: maskedSettings[s.key] || "",
							})),
						],
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				);
			},

			PUT: async ({
				request,
				params,
			}: {
				request: Request;
				params: { id: string };
			}) => {
				const user = getRequestUser(request);
				const err = requireLedgerManage(user);
				if (err) return err;

				const { eq } = await import("drizzle-orm");
				const [row] = await db
					.select()
					.from(ledgerProvider)
					.where(eq(ledgerProvider.id, params.id))
					.limit(1);

				if (!row) {
					return new Response(JSON.stringify({ error: "Provider not found" }), {
						status: 404,
						headers: { "Content-Type": "application/json" },
					});
				}

				let body: Record<string, string>;
				try {
					body = await request.json();
				} catch {
					return new Response(JSON.stringify({ error: "Invalid JSON" }), {
						status: 400,
						headers: { "Content-Type": "application/json" },
					});
				}

				// Merge new settings with existing (don't overwrite masked fields)
				const existingSettings = row.settings
					? decryptSettings(row.settings)
					: {};
				const provider = getProviderByType(row.type);
				const schema = provider?.getSettingsSchema() ?? [];

				for (const field of schema) {
					if (body[field.key] && !body[field.key].startsWith("*")) {
						existingSettings[field.key] = body[field.key];
					}
				}

				if (body.name) {
					await db
						.update(ledgerProvider)
						.set({
							name: body.name,
							settings: encryptSettings(existingSettings),
							updatedAt: new Date(),
						})
						.where(eq(ledgerProvider.id, params.id));
				} else {
					await db
						.update(ledgerProvider)
						.set({
							settings: encryptSettings(existingSettings),
							updatedAt: new Date(),
						})
						.where(eq(ledgerProvider.id, params.id));
				}

				return new Response(JSON.stringify({ success: true }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			},
		},
	},
});
