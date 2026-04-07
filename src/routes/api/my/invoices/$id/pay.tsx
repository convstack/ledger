import { createFileRoute } from "@tanstack/react-router";
import { db } from "~/db";
import { invoice, invoiceItem } from "~/db/schema";
import { getRequestUser } from "~/lib/auth";
import { getActiveProvider } from "~/lib/providers/registry";

export const Route = createFileRoute("/api/my/invoices/$id/pay")({
	server: {
		handlers: {
			/** @openapi
			 * summary: Initiate payment for own invoice
			 * auth: user
			 * response: 200
			 *   redirect: string
			 *   message: string
			 * error: 400 Invoice is not payable
			 * error: 401 Unauthorized
			 * error: 404 Invoice not found
			 * error: 501 No payment provider configured
			 */
			POST: async ({
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

				if (inv.status !== "pending") {
					return new Response(
						JSON.stringify({ error: "Invoice is not payable" }),
						{ status: 400, headers: { "Content-Type": "application/json" } },
					);
				}

				const provider = await getActiveProvider();
				if (!provider) {
					return new Response(
						JSON.stringify({ error: "No payment provider configured" }),
						{ status: 501, headers: { "Content-Type": "application/json" } },
					);
				}

				const items = await db
					.select()
					.from(invoiceItem)
					.where(eq(invoiceItem.invoiceId, params.id));

				const result = await provider.initiatePayment({
					id: inv.id,
					userId: inv.userId,
					total: inv.total,
					currency: inv.currency,
					items: items.map((i) => ({
						description: i.description,
						quantity: i.quantity,
						unitPrice: i.unitPrice,
						total: i.total,
					})),
					providerRef: inv.providerRef,
				});

				if (result.type === "redirect") {
					return new Response(
						JSON.stringify({ redirect: result.redirectUrl }),
						{
							status: 200,
							headers: { "Content-Type": "application/json" },
						},
					);
				}

				// For instructions-based providers, store instructions on the invoice
				if (result.instructions) {
					await db
						.update(invoice)
						.set({
							paymentInstructions: result.instructions,
							updatedAt: new Date(),
						})
						.where(eq(invoice.id, params.id));
				}

				return new Response(
					JSON.stringify({
						message: result.instructions,
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				);
			},
		},
	},
});
