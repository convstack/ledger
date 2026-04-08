import { createFileRoute } from "@tanstack/react-router";
import { db } from "~/db";
import { invoice } from "~/db/schema";
import { requireServiceOrPermission } from "~/lib/auth";
import { resolveUserName } from "~/lib/users";

export const Route = createFileRoute("/api/invoices/$id")({
	server: {
		handlers: {
			/** @openapi
			 * summary: Get invoice details
			 * auth: staff
			 * response: 200
			 *   fields: Array<{key: string, label: string, value: string | number}>
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
					.select()
					.from(invoice)
					.where(eq(invoice.id, params.id))
					.limit(1);

				if (!inv) {
					return new Response(JSON.stringify({ error: "Invoice not found" }), {
						status: 404,
						headers: { "Content-Type": "application/json" },
					});
				}

				const userName = await resolveUserName(inv.userId);

				return new Response(
					JSON.stringify({
						fields: [
							{
								key: "invoiceNumber",
								label: "Invoice #",
								value: inv.invoiceNumber || "—",
							},
							{ key: "user", label: "User", value: userName },
							{
								key: "status",
								label: "Status",
								value: inv.status,
							},
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
							{
								key: "notes",
								label: "Notes",
								value: inv.notes || "—",
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
