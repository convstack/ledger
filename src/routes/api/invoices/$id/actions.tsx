import { createFileRoute } from "@tanstack/react-router";
import { db } from "~/db";
import { invoice } from "~/db/schema";
import { getRequestUser, requireLedgerManage } from "~/lib/auth";
import { getActiveProvider } from "~/lib/providers/registry";

export const Route = createFileRoute("/api/invoices/$id/actions")({
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
