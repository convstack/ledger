import { createFileRoute } from "@tanstack/react-router";
import { db } from "~/db";
import { invoice } from "~/db/schema";
import { getRequestUser } from "~/lib/auth";

export const Route = createFileRoute("/api/my/invoices")({
	server: {
		handlers: {
			/** @openapi
			 * summary: List current user's invoices
			 * auth: user
			 * response: 200
			 *   columns: Array<{key: string, label: string}>
			 *   rows: Array<{id: string, status: string, amount: string, createdAt: string}>
			 *   total: number
			 * error: 401 Unauthorized
			 */
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
						id: invoice.id,
						status: invoice.status,
						total: invoice.total,
						currency: invoice.currency,
						createdAt: invoice.createdAt,
					})
					.from(invoice)
					.where(eq(invoice.userId, user.id))
					.orderBy(desc(invoice.createdAt))
					.limit(100);

				return new Response(
					JSON.stringify({
						columns: [
							{ key: "status", label: "Status" },
							{ key: "amount", label: "Amount" },
							{ key: "createdAt", label: "Date" },
						],
						rows: rows.map((r) => ({
							id: r.id,
							status: r.status,
							amount: `${(r.total / 100).toFixed(2)} ${r.currency}`,
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
