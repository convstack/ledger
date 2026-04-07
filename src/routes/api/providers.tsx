import { createFileRoute } from "@tanstack/react-router";
import { nanoid } from "nanoid";
import { db } from "~/db";
import { ledgerProvider } from "~/db/schema";
import { requireServiceOrStaff } from "~/lib/auth";
import { encryptSettings } from "~/lib/crypto";
import { getProviderByType } from "~/lib/providers/registry";

export const Route = createFileRoute("/api/providers")({
	server: {
		handlers: {
			/** @openapi
			 * summary: List all payment providers
			 * auth: staff
			 * response: 200
			 *   columns: Array<{key: string, label: string}>
			 *   rows: Array<{id: string, name: string, type: string, status: string}>
			 *   total: number
			 * error: 401 Unauthorized
			 * error: 403 Forbidden
			 */
			GET: async ({ request }: { request: Request }) => {
				const err = await requireServiceOrStaff(request);
				if (err) return err;

				const rows = await db.select().from(ledgerProvider);

				return new Response(
					JSON.stringify({
						columns: [
							{ key: "name", label: "Name" },
							{ key: "type", label: "Type" },
							{ key: "status", label: "Status" },
						],
						rows: rows.map((r) => ({
							id: r.id,
							name: r.name,
							type: r.type,
							status: r.active ? "Active" : "Inactive",
						})),
						total: rows.length,
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				);
			},

			/** @openapi
			 * summary: Create a new payment provider
			 * auth: staff
			 * body:
			 *   type: string (required) - Provider type (e.g. stripe, manual)
			 *   name: string (required) - Display name
			 * response: 201
			 *   success: boolean
			 *   redirect: string
			 * error: 400 Invalid JSON
			 * error: 400 Type and name are required
			 * error: 400 Unknown provider type
			 * error: 401 Unauthorized
			 * error: 403 Forbidden
			 */
			POST: async ({ request }: { request: Request }) => {
				const err = await requireServiceOrStaff(request);
				if (err) return err;

				let body: { type?: string; name?: string };
				try {
					body = await request.json();
				} catch {
					return new Response(JSON.stringify({ error: "Invalid JSON" }), {
						status: 400,
						headers: { "Content-Type": "application/json" },
					});
				}

				const { type, name } = body;
				if (!type || !name) {
					return new Response(
						JSON.stringify({ error: "Type and name are required" }),
						{ status: 400, headers: { "Content-Type": "application/json" } },
					);
				}

				const provider = getProviderByType(type);
				if (!provider) {
					return new Response(
						JSON.stringify({ error: `Unknown provider type: ${type}` }),
						{ status: 400, headers: { "Content-Type": "application/json" } },
					);
				}

				const id = nanoid();
				await db.insert(ledgerProvider).values({
					id,
					type,
					name,
					active: false,
					settings: encryptSettings({}),
					capabilities: provider.capabilities,
					createdAt: new Date(),
					updatedAt: new Date(),
				});

				return new Response(
					JSON.stringify({
						success: true,
						redirect: `/ledger/providers/${id}`,
					}),
					{ status: 201, headers: { "Content-Type": "application/json" } },
				);
			},
		},
	},
});
