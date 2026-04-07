import { createFileRoute } from "@tanstack/react-router";
import { db } from "~/db";
import { product, subscription } from "~/db/schema";
import { getRequestUser } from "~/lib/auth";

export const Route = createFileRoute("/api/my/subscriptions/$id")({
	server: {
		handlers: {
			/** @openapi
			 * summary: Get own subscription details
			 * auth: user
			 * response: 200
			 *   fields: array
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
						id: subscription.id,
						productName: product.name,
						status: subscription.status,
						currentPeriodStart: subscription.currentPeriodStart,
						currentPeriodEnd: subscription.currentPeriodEnd,
						cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
						cancelledAt: subscription.cancelledAt,
						createdAt: subscription.createdAt,
					})
					.from(subscription)
					.leftJoin(product, eq(subscription.productId, product.id))
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

				return new Response(
					JSON.stringify({
						fields: [
							{
								key: "product",
								label: "Product",
								value: sub.productName || "—",
							},
							{
								key: "status",
								label: "Status",
								value: sub.cancelAtPeriodEnd
									? `${sub.status} (cancelling)`
									: sub.status,
							},
							{
								key: "currentPeriodStart",
								label: "Period Start",
								value: sub.currentPeriodStart?.toISOString() || "—",
							},
							{
								key: "currentPeriodEnd",
								label: "Period End",
								value: sub.currentPeriodEnd?.toISOString() || "—",
							},
							{
								key: "cancelledAt",
								label: "Cancelled At",
								value: sub.cancelledAt?.toISOString() || "—",
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
		},
	},
});
