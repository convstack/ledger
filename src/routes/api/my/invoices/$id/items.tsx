import { createFileRoute } from "@tanstack/react-router";
import { db } from "~/db";
import { invoice, invoiceItem } from "~/db/schema";
import { getRequestUser } from "~/lib/auth";

export const Route = createFileRoute("/api/my/invoices/$id/items")({
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
				if (!user) {
					return new Response(JSON.stringify({ error: "Unauthorized" }), {
						status: 401,
						headers: { "Content-Type": "application/json" },
					});
				}

				const { eq, and } = await import("drizzle-orm");

				// Verify the invoice belongs to this user
				const [inv] = await db
					.select({ id: invoice.id })
					.from(invoice)
					.where(and(eq(invoice.id, params.id), eq(invoice.userId, user.id)))
					.limit(1);

				if (!inv) {
					return new Response(JSON.stringify({ error: "Invoice not found" }), {
						status: 404,
						headers: { "Content-Type": "application/json" },
					});
				}

				const items = await db
					.select()
					.from(invoiceItem)
					.where(eq(invoiceItem.invoiceId, params.id));

				return new Response(
					JSON.stringify({
						columns: [
							{ key: "description", label: "Description" },
							{ key: "quantity", label: "Qty" },
							{ key: "unitPrice", label: "Unit Price" },
							{ key: "total", label: "Total" },
						],
						rows: items.map((item) => ({
							id: item.id,
							description: item.description,
							quantity: item.quantity,
							unitPrice: `${(item.unitPrice / 100).toFixed(2)}`,
							total: `${(item.total / 100).toFixed(2)}`,
						})),
						total: items.length,
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				);
			},
		},
	},
});
