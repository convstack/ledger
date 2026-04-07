import { createFileRoute } from "@tanstack/react-router";
import { db } from "~/db";
import { product, subscription } from "~/db/schema";
import { getRequestUser, requireLedgerManage } from "~/lib/auth";
import { resolveUserNames } from "~/lib/users";

export const Route = createFileRoute("/api/subscriptions")({
	server: {
		handlers: {
			/** @openapi
			 * summary: List all subscriptions
			 * auth: staff
			 * response: 200
			 *   columns: Array<{key: string, label: string}>
			 *   rows: Array<{id: string, user: string, product: string, status: string, currentPeriodEnd: string, createdAt: string}>
			 *   total: number
			 * error: 401 Unauthorized
			 * error: 403 Forbidden
			 */
			GET: async ({ request }: { request: Request }) => {
				const user = getRequestUser(request);
				const err = requireLedgerManage(user);
				if (err) return err;

				const { desc, eq } = await import("drizzle-orm");

				const rows = await db
					.select({
						id: subscription.id,
						userId: subscription.userId,
						productName: product.name,
						status: subscription.status,
						currentPeriodEnd: subscription.currentPeriodEnd,
						createdAt: subscription.createdAt,
					})
					.from(subscription)
					.leftJoin(product, eq(subscription.productId, product.id))
					.orderBy(desc(subscription.createdAt))
					.limit(200);

				const userIds = rows.map((r) => r.userId);
				const nameMap = await resolveUserNames(userIds);

				return new Response(
					JSON.stringify({
						columns: [
							{ key: "user", label: "User" },
							{ key: "product", label: "Product" },
							{ key: "status", label: "Status" },
							{ key: "currentPeriodEnd", label: "Renews" },
							{ key: "createdAt", label: "Created" },
						],
						rows: rows.map((r) => ({
							id: r.id,
							user: nameMap.get(r.userId) || r.userId,
							product: r.productName || "—",
							status: r.status,
							currentPeriodEnd: r.currentPeriodEnd?.toISOString() || "—",
							createdAt: r.createdAt?.toISOString(),
						})),
						total: rows.length,
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				);
			},
		},
	},
});
