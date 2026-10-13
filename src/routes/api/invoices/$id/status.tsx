import { createFileRoute } from "@tanstack/react-router";
import { db } from "~/db";
import { invoice } from "~/db/schema";
import { requireAnyPermission } from "~/lib/auth";
import { mayActOnInvoice } from "~/lib/invoice-access";

export const Route = createFileRoute("/api/invoices/$id/status")({
	server: {
		handlers: {
			/** @openapi
			 * summary: Get invoice payment status (service-to-service)
			 * description: Needs ledger:invoices:status or ledger:manage, held by the user or granted to the calling service under Allowed Callers. The narrow permission only covers invoices the calling service created.
			 * auth: ledger:invoices:status or ledger:manage
			 * response: 200
			 *   id: string
			 *   status: string
			 *   total: number
			 *   currency: string
			 *   paidAt: string | null
			 * error: 401 Unauthorized
			 * error: 403 Forbidden
			 * error: 404 Invoice not found
			 * error: 503 Service unavailable while lanyard can't be reached
			 */
			GET: async ({
				request,
				params,
			}: {
				request: Request;
				params: { id: string };
			}) => {
				const err = await requireAnyPermission(request, [
					"ledger:invoices:status",
					"ledger:manage",
				]);
				if (err) return err;

				const { eq } = await import("drizzle-orm");
				const [inv] = await db
					.select({
						id: invoice.id,
						status: invoice.status,
						total: invoice.total,
						currency: invoice.currency,
						paidAt: invoice.paidAt,
						createdByService: invoice.createdByService,
					})
					.from(invoice)
					.where(eq(invoice.id, params.id))
					.limit(1);

				if (!inv || !(await mayActOnInvoice(request, inv.createdByService))) {
					return new Response(JSON.stringify({ error: "Invoice not found" }), {
						status: 404,
						headers: { "Content-Type": "application/json" },
					});
				}

				return new Response(
					JSON.stringify({
						id: inv.id,
						status: inv.status,
						total: inv.total,
						currency: inv.currency,
						paidAt: inv.paidAt,
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				);
			},
		},
	},
});
