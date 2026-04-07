import { createFileRoute } from "@tanstack/react-router";
import { db } from "~/db";
import { invoice } from "~/db/schema";
import { requireServiceKey } from "~/lib/auth";

export const Route = createFileRoute("/api/invoices/$id/status")({
	server: {
		handlers: {
			/** @openapi
			 * summary: Get invoice payment status (service-to-service)
			 * auth: admin
			 * response: 200
			 *   id: string
			 *   status: string
			 *   total: number
			 *   currency: string
			 *   paidAt: string | null
			 * error: 401 Unauthorized
			 * error: 404 Invoice not found
			 */
			GET: async ({
				request,
				params,
			}: {
				request: Request;
				params: { id: string };
			}) => {
				const keyErr = await requireServiceKey(request);
				if (keyErr) return keyErr;

				const { eq } = await import("drizzle-orm");
				const [inv] = await db
					.select({
						id: invoice.id,
						status: invoice.status,
						total: invoice.total,
						currency: invoice.currency,
						paidAt: invoice.paidAt,
					})
					.from(invoice)
					.where(eq(invoice.id, params.id))
					.limit(1);

				if (!inv) {
					return new Response(JSON.stringify({ error: "Invoice not found" }), {
						status: 404,
						headers: { "Content-Type": "application/json" },
					});
				}

				return new Response(JSON.stringify(inv), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			},
		},
	},
});
