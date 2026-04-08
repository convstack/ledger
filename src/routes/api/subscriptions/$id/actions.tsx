import { createFileRoute } from "@tanstack/react-router";
import { db } from "~/db";
import { subscription } from "~/db/schema";
import { requireServiceOrPermission } from "~/lib/auth";

export const Route = createFileRoute("/api/subscriptions/$id/actions")({
	server: {
		handlers: {
			/** @openapi
			 * summary: Get admin actions for a subscription
			 * auth: staff
			 * response: 200
			 *   actions: array
			 * error: 401 Unauthorized
			 * error: 404 Subscription not found
			 */
			GET: async ({
				request,
				params,
			}: {
				request: Request;
				params: { id: string };
			}) => {
				const err = await requireServiceOrPermission(request, "ledger:manage");
				if (err) return err;

				const { eq } = await import("drizzle-orm");
				const [sub] = await db
					.select({
						status: subscription.status,
						cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
					})
					.from(subscription)
					.where(eq(subscription.id, params.id))
					.limit(1);

				if (!sub) {
					return new Response(
						JSON.stringify({ error: "Subscription not found" }),
						{
							status: 404,
							headers: { "Content-Type": "application/json" },
						},
					);
				}

				const actions = [];

				if (sub.status === "active" && !sub.cancelAtPeriodEnd) {
					actions.push({
						label: "Cancel",
						endpoint: `/api/subscriptions/${params.id}/cancel`,
						method: "POST",
						variant: "danger",
						confirm:
							"Cancel this subscription? It will remain active until the end of the billing period.",
					});
				}

				if (sub.status === "active" && sub.cancelAtPeriodEnd) {
					actions.push({
						label: "Reactivate",
						endpoint: `/api/subscriptions/${params.id}/reactivate`,
						method: "POST",
						confirm: "Reactivate this subscription?",
					});
				}

				if (sub.status === "cancelled" || sub.status === "past_due") {
					actions.push({
						label: "Reactivate",
						endpoint: `/api/subscriptions/${params.id}/reactivate`,
						method: "POST",
						confirm: "Reactivate this subscription?",
					});
				}

				return new Response(JSON.stringify({ actions }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			},
		},
	},
});
