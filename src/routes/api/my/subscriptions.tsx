import { createFileRoute } from "@tanstack/react-router";
import { db } from "~/db";
import { product, subscription } from "~/db/schema";
import { getRequestUser } from "~/lib/auth";

export const Route = createFileRoute("/api/my/subscriptions")({
	server: {
		handlers: {
			GET: async ({ request }: { request: Request }) => {
				const user = getRequestUser(request);
				if (!user) {
					return new Response(JSON.stringify({ error: "Unauthorized" }), {
						status: 401,
						headers: { "Content-Type": "application/json" },
					});
				}

				const { eq, desc } = await import("drizzle-orm");

				const rows = await db
					.select({
						id: subscription.id,
						productName: product.name,
						status: subscription.status,
						currentPeriodEnd: subscription.currentPeriodEnd,
						cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
						createdAt: subscription.createdAt,
					})
					.from(subscription)
					.leftJoin(product, eq(subscription.productId, product.id))
					.where(eq(subscription.userId, user.id))
					.orderBy(desc(subscription.createdAt))
					.limit(50);

				return new Response(
					JSON.stringify({
						columns: [
							{ key: "product", label: "Product" },
							{ key: "status", label: "Status" },
							{ key: "renews", label: "Renews" },
						],
						rows: rows.map((r) => ({
							id: r.id,
							product: r.productName || "—",
							status: r.cancelAtPeriodEnd
								? `${r.status} (cancelling)`
								: r.status,
							renews: r.currentPeriodEnd?.toISOString() || "—",
						})),
						total: rows.length,
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				);
			},
		},
	},
});
