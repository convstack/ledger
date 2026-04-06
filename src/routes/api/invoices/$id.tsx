import { createFileRoute } from "@tanstack/react-router";
import { db } from "~/db";
import { invoice } from "~/db/schema";
import { getRequestUser, requireLedgerManage } from "~/lib/auth";
import { resolveUserName } from "~/lib/users";

export const Route = createFileRoute("/api/invoices/$id")({
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
