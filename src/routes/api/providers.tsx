import { createFileRoute } from "@tanstack/react-router";
import { nanoid } from "nanoid";
import { db } from "~/db";
import { ledgerProvider } from "~/db/schema";
import { getRequestUser, requireLedgerManage } from "~/lib/auth";
import { encryptSettings } from "~/lib/crypto";
import { getProviderByType } from "~/lib/providers/registry";

export const Route = createFileRoute("/api/providers")({
	server: {
		handlers: {
			GET: async ({ request }: { request: Request }) => {
				const user = getRequestUser(request);
				const err = requireLedgerManage(user);
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

			POST: async ({ request }: { request: Request }) => {
				const user = getRequestUser(request);
				const err = requireLedgerManage(user);
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
