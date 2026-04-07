import { createFileRoute } from "@tanstack/react-router";
import { nanoid } from "nanoid";
import { db } from "~/db";
import { webhookSubscriber } from "~/db/schema";
import { getRequestUser, requireLedgerManage } from "~/lib/auth";

export const Route = createFileRoute("/api/webhooks/subscribers")({
	server: {
		handlers: {
			/** @openapi
			 * summary: List all webhook subscribers
			 * auth: staff
			 * response: 200
			 *   columns: Array<{key: string, label: string}>
			 *   rows: Array<{id: string, name: string, url: string, events: string, status: string}>
			 *   total: number
			 * error: 401 Unauthorized
			 * error: 403 Forbidden
			 */
			GET: async ({ request }: { request: Request }) => {
				const user = getRequestUser(request);
				const err = requireLedgerManage(user);
				if (err) return err;

				const { desc } = await import("drizzle-orm");

				const rows = await db
					.select()
					.from(webhookSubscriber)
					.orderBy(desc(webhookSubscriber.createdAt));

				return new Response(
					JSON.stringify({
						columns: [
							{ key: "name", label: "Name" },
							{ key: "url", label: "URL" },
							{ key: "events", label: "Events" },
							{ key: "status", label: "Status" },
						],
						rows: rows.map((r) => ({
							id: r.id,
							name: r.name,
							url: r.url,
							events: (r.events as string[]).join(", "),
							status: r.active ? "Active" : "Inactive",
						})),
						total: rows.length,
					}),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				);
			},

			/** @openapi
			 * summary: Create a webhook subscriber
			 * auth: staff
			 * body:
			 *   name: string (required) - Subscriber name
			 *   url: string (required) - Webhook delivery URL
			 *   secret: string - Signing secret, auto-generated if omitted
			 *   events: string - Comma-separated event list, defaults to "*"
			 * response: 201
			 *   success: boolean
			 *   id: string
			 *   secret: string
			 *   message: string
			 *   redirect: string
			 * error: 400 Invalid JSON
			 * error: 400 Name and URL are required
			 * error: 401 Unauthorized
			 * error: 403 Forbidden
			 */
			POST: async ({ request }: { request: Request }) => {
				const user = getRequestUser(request);
				const err = requireLedgerManage(user);
				if (err) return err;

				let body: {
					name?: string;
					url?: string;
					secret?: string;
					events?: string;
				};
				try {
					body = await request.json();
				} catch {
					return new Response(JSON.stringify({ error: "Invalid JSON" }), {
						status: 400,
						headers: { "Content-Type": "application/json" },
					});
				}

				if (!body.name || !body.url) {
					return new Response(
						JSON.stringify({
							error: "Name and URL are required",
						}),
						{
							status: 400,
							headers: { "Content-Type": "application/json" },
						},
					);
				}

				const id = nanoid();
				const secret = body.secret || nanoid(32);
				const events = body.events
					? body.events
							.split(",")
							.map((e) => e.trim())
							.filter(Boolean)
					: ["*"];

				const now = new Date();
				await db.insert(webhookSubscriber).values({
					id,
					name: body.name,
					url: body.url,
					secret,
					events,
					active: true,
					createdAt: now,
					updatedAt: now,
				});

				return new Response(
					JSON.stringify({
						success: true,
						id,
						secret,
						message:
							"Save this secret — it will be sent as X-Webhook-Secret header with each delivery.",
						redirect: `/ledger/webhooks/subscribers/${id}`,
					}),
					{
						status: 201,
						headers: { "Content-Type": "application/json" },
					},
				);
			},
		},
	},
});
