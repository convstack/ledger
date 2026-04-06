import { createFileRoute } from "@tanstack/react-router";
import { db } from "~/db";
import { webhookSubscriber } from "~/db/schema";
import { getRequestUser, requireLedgerManage } from "~/lib/auth";

export const Route = createFileRoute("/api/webhooks/subscribers/$id/actions")({
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

				const actions = [
					{
						label: sub.active ? "Disable" : "Enable",
						endpoint: `/api/webhooks/subscribers/${params.id}/toggle`,
						method: "POST",
						confirm: sub.active
							? "Disable this webhook subscriber?"
							: "Enable this webhook subscriber?",
					},
					{
						label: "Delete",
						endpoint: `/api/webhooks/subscribers/${params.id}`,
						method: "DELETE",
						variant: "danger",
						confirm: "Delete this webhook subscriber? This cannot be undone.",
					},
				];

				return new Response(JSON.stringify({ actions }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			},
		},
	},
});
