import { createFileRoute } from "@tanstack/react-router";
import { db } from "~/db";
import { invoice } from "~/db/schema";
import { getRequestUser } from "~/lib/auth";

export const Route = createFileRoute("/api/my/invoices/$id")({
	server: {
		handlers: {
			/** @openapi
			 * summary: Get details of own invoice
			 * auth: user
			 * response: 200
			 *   fields: Array<{key: string, label: string, value: string | number}>
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
				const user = getRequestUser(request);
				if (!user) {
					return new Response(JSON.stringify({ error: "Unauthorized" }), {
						status: 401,
						headers: { "Content-Type": "application/json" },
					});
				}

				const { eq, and } = await import("drizzle-orm");

				const [inv] = await db
					.select()
					.from(invoice)
					.where(and(eq(invoice.id, params.id), eq(invoice.userId, user.id)))
					.limit(1);

				if (!inv) {
					return new Response(JSON.stringify({ error: "Invoice not found" }), {
						status: 404,
						headers: { "Content-Type": "application/json" },
					});
				}

				const fields = [
					{
						key: "invoiceNumber",
						label: "Invoice #",
						value: inv.invoiceNumber || "—",
					},
					{ key: "status", label: "Status", value: inv.status },
					{
						key: "subtotal",
						label: "Subtotal",
						value: `${(inv.subtotal / 100).toFixed(2)} ${inv.currency}`,
					},
					{
						key: "tax",
						label: "Tax",
						value: `${(inv.tax / 100).toFixed(2)} ${inv.currency}`,
					},
					{
						key: "total",
						label: "Total",
						value: `${(inv.total / 100).toFixed(2)} ${inv.currency}`,
					},
					{
						key: "dueDate",
						label: "Due Date",
						value: inv.dueDate?.toISOString() || "—",
					},
					{
						key: "paidAt",
						label: "Paid At",
						value: inv.paidAt?.toISOString() || "—",
					},
					{
						key: "createdAt",
						label: "Created",
						value: inv.createdAt?.toISOString() || "",
					},
				];

				// Show payment instructions if available (manual provider)
				if (inv.paymentInstructions) {
					fields.push({
						key: "paymentInstructions",
						label: "Payment Instructions",
						value: inv.paymentInstructions,
					});
				}

				return new Response(JSON.stringify({ fields }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			},
		},
	},
});
