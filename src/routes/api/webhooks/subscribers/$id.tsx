import { createFileRoute } from "@tanstack/react-router";
import { db } from "~/db";
import { webhookSubscriber } from "~/db/schema";
import { getRequestUser, requireLedgerManage } from "~/lib/auth";

export const Route = createFileRoute("/api/webhooks/subscribers/$id")({
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
				const [sub] = await db
					.select()
					.from(webhookSubscriber)
					.where(eq(webhookSubscriber.id, params.id))
					.limit(1);

				if (!sub) {
					return new Response(
						JSON.stringify({ error: "Subscriber not found" }),
						{
							status: 404,
							headers: { "Content-Type": "application/json" },
						},
					);
				}

				return new Response(
					JSON.stringify({
						fields: [
							{ key: "name", label: "Name", value: sub.name },
							{ key: "url", label: "URL", value: sub.url },
							{
								key: "secret",
								label: "Secret",
								value: `${sub.secret.slice(0, 8)}...`,
							},
							{
								key: "events",
								label: "Events",
								value: (sub.events as string[]).join(", "),
							},
							{
								key: "active",
								label: "Active",
								value: sub.active,
							},
							{
								key: "createdAt",
								label: "Created",
								value: sub.createdAt?.toISOString() || "",
							},
						],
					}),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
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

				let body: Record<string, string>;
				try {
					body = await request.json();
				} catch {
					return new Response(JSON.stringify({ error: "Invalid JSON" }), {
						status: 400,
						headers: { "Content-Type": "application/json" },
					});
				}

				const updates: Record<string, unknown> = {
					updatedAt: new Date(),
				};
				if (body.name) updates.name = body.name;
				if (body.url) updates.url = body.url;
				if (body.events) {
					updates.events = body.events
						.split(",")
						.map((e) => e.trim())
						.filter(Boolean);
				}

				await db
					.update(webhookSubscriber)
					.set(updates)
					.where(eq(webhookSubscriber.id, params.id));

				return new Response(JSON.stringify({ success: true }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			},

			DELETE: async ({
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
				await db
					.delete(webhookSubscriber)
					.where(eq(webhookSubscriber.id, params.id));

				return new Response(
					JSON.stringify({
						success: true,
						redirect: "/ledger/webhooks/subscribers",
					}),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				);
			},
		},
	},
});
