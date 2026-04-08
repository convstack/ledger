import { createFileRoute } from "@tanstack/react-router";
import { db } from "~/db";
import { invoice } from "~/db/schema";
import { requireServiceOrPermission } from "~/lib/auth";
import { getActiveProvider } from "~/lib/providers/registry";

export const Route = createFileRoute("/api/invoices/$id/actions")({
	server: {
		handlers: {
			/** @openapi
			 * summary: Get available actions for an invoice
			 * auth: staff
			 * response: 200
			 *   actions: Array<{label: string, endpoint: string, method: string, variant?: string, confirm?: string}>
			 * error: 401 Unauthorized
			 * error: 403 Forbidden
			 * error: 404 Invoice not found
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
				const [inv] = await db
					.select({
						status: invoice.status,
						providerRef: invoice.providerRef,
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

				const actions = [];

				if (inv.status === "pending" || inv.status === "draft") {
					actions.push({
						label: "Mark as Paid",
						endpoint: `/api/invoices/${params.id}/mark-paid`,
						method: "POST",
						confirm: "Mark this invoice as paid?",
					});
					actions.push({
						label: "Cancel",
						endpoint: `/api/invoices/${params.id}/cancel`,
						method: "POST",
						variant: "danger",
						confirm: "Cancel this invoice?",
					});
				}

				if (inv.status === "paid") {
					const provider = await getActiveProvider();
					if (provider?.capabilities.refunds && provider.refundPayment) {
						actions.push({
							label: "Refund",
							endpoint: `/api/invoices/${params.id}/refund`,
							method: "POST",
							variant: "danger",
							confirm: "Refund this invoice? This cannot be undone.",
						});
					}
				}

				return new Response(JSON.stringify({ actions }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			},
		},
	},
});
