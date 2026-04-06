import { createFileRoute } from "@tanstack/react-router";
import { db } from "~/db";
import { product, subscription } from "~/db/schema";
import { getRequestUser, requireLedgerManage } from "~/lib/auth";
import { resolveUserName } from "~/lib/users";

export const Route = createFileRoute("/api/subscriptions/$id")({
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

				const [row] = await db
					.select({
						id: subscription.id,
						userId: subscription.userId,
						productName: product.name,
						status: subscription.status,
						providerRef: subscription.providerRef,
						currentPeriodStart: subscription.currentPeriodStart,
						currentPeriodEnd: subscription.currentPeriodEnd,
						cancelledAt: subscription.cancelledAt,
						cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
						createdAt: subscription.createdAt,
					})
					.from(subscription)
					.leftJoin(product, eq(subscription.productId, product.id))
					.where(eq(subscription.id, params.id))
					.limit(1);

				if (!row) {
					return new Response(
						JSON.stringify({ error: "Subscription not found" }),
						{ status: 404, headers: { "Content-Type": "application/json" } },
					);
				}

				const userName = await resolveUserName(row.userId);

				return new Response(
					JSON.stringify({
						fields: [
							{ key: "id", label: "Subscription ID", value: row.id },
							{ key: "user", label: "User", value: userName },
							{
								key: "product",
								label: "Product",
								value: row.productName || "—",
							},
							{ key: "status", label: "Status", value: row.status },
							{
								key: "currentPeriodStart",
								label: "Period Start",
								value: row.currentPeriodStart?.toISOString() || "—",
							},
							{
								key: "currentPeriodEnd",
								label: "Period End",
								value: row.currentPeriodEnd?.toISOString() || "—",
							},
							{
								key: "cancelAtPeriodEnd",
								label: "Cancels at Period End",
								value: row.cancelAtPeriodEnd ?? false,
							},
							{
								key: "cancelledAt",
								label: "Cancelled At",
								value: row.cancelledAt?.toISOString() || "—",
							},
							{
								key: "createdAt",
								label: "Created",
								value: row.createdAt?.toISOString() || "",
							},
						],
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				);
			},
		},
	},
});
