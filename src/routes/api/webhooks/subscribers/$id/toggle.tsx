import { createFileRoute } from "@tanstack/react-router";
import { db } from "~/db";
import { webhookSubscriber } from "~/db/schema";
import { getRequestUser, requireLedgerManage } from "~/lib/auth";

export const Route = createFileRoute("/api/webhooks/subscribers/$id/toggle")({
	server: {
		handlers: {
			POST: async ({
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
					.select({ active: webhookSubscriber.active })
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

				await db
					.update(webhookSubscriber)
					.set({
						active: !sub.active,
						updatedAt: new Date(),
					})
					.where(eq(webhookSubscriber.id, params.id));

				return new Response(JSON.stringify({ success: true }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			},
		},
	},
});
