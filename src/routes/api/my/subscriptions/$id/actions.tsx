import { createFileRoute } from "@tanstack/react-router";
import { db } from "~/db";
import { ledgerSettings, subscription } from "~/db/schema";
import { getRequestUser } from "~/lib/auth";

export const Route = createFileRoute("/api/my/subscriptions/$id/actions")({
	server: {
		handlers: {
			/** @openapi
			 * summary: Get available actions for own subscription
			 * auth: user
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
				const user = getRequestUser(request);
				if (!user) {
					return new Response(JSON.stringify({ error: "Unauthorized" }), {
						status: 401,
						headers: { "Content-Type": "application/json" },
					});
				}

				const { eq, and } = await import("drizzle-orm");

				const [sub] = await db
					.select({
						status: subscription.status,
						cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
					})
					.from(subscription)
					.where(
						and(
							eq(subscription.id, params.id),
							eq(subscription.userId, user.id),
						),
					)
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

				// Check if self-cancel is allowed
				const [settings] = await db
					.select({ allowSelfCancel: ledgerSettings.allowSelfCancel })
					.from(ledgerSettings)
					.where(eq(ledgerSettings.id, "default"))
					.limit(1);

				const actions = [];

				if (
					sub.status === "active" &&
					!sub.cancelAtPeriodEnd &&
					(settings?.allowSelfCancel ?? true)
				) {
					actions.push({
						label: "Cancel Subscription",
						endpoint: `/api/my/subscriptions/${params.id}/cancel`,
						method: "POST",
						variant: "danger",
						confirm:
							"Cancel this subscription? It will remain active until the end of the current billing period.",
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
