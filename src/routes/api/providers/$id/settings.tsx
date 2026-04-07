import { createFileRoute } from "@tanstack/react-router";
import { db } from "~/db";
import { ledgerProvider } from "~/db/schema";
import { getRequestUser, requireLedgerManage } from "~/lib/auth";
import { decryptSettings } from "~/lib/crypto";
import { getProviderByType } from "~/lib/providers/registry";

export const Route = createFileRoute("/api/providers/$id/settings")({
	server: {
		handlers: {
			/** @openapi
			 * summary: Get provider settings form schema and values
			 * auth: staff
			 * response: 200
			 *   fields: Array<{key: string, label: string, type: string, required?: boolean, placeholder?: string, options?: Array, value: string}>
			 * error: 401 Unauthorized
			 * error: 403 Forbidden
			 * error: 404 Provider not found
			 */
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

				const provider = getProviderByType(row.type);
				const schema = provider?.getSettingsSchema() ?? [];
				const settings = row.settings ? decryptSettings(row.settings) : {};

				// Return field definitions + values so the form section
				// renders only the fields relevant to this provider type
				const fields = [
					{
						key: "name",
						label: "Display Name",
						type: "text",
						value: row.name,
					},
					...schema.map((s) => {
						const val = settings[s.key] || "";
						return {
							key: s.key,
							label: s.label,
							type: s.type,
							required: s.required,
							placeholder: s.placeholder,
							options: s.options,
							value:
								s.type === "password" && val
									? `${"*".repeat(Math.min(val.length, 8))}`
									: val,
						};
					}),
				];

				return new Response(JSON.stringify({ fields }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			},
		},
	},
});
