import { createFileRoute } from "@tanstack/react-router";
import { db } from "~/db";
import { invoice } from "~/db/schema";
import { getRequestUser } from "~/lib/auth";
import { getActiveProvider } from "~/lib/providers/registry";

export const Route = createFileRoute("/api/my/invoices/$id/actions")({
	server: {
		handlers: {
			/** @openapi
			 * summary: Get available actions for own invoice
			 * auth: user
			 * response: 200
			 *   actions: Array<{label: string, endpoint: string, method: string}>
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
					.select({ status: invoice.status, userId: invoice.userId })
					.from(invoice)
					.where(and(eq(invoice.id, params.id), eq(invoice.userId, user.id)))
					.limit(1);

				if (!inv) {
					return new Response(JSON.stringify({ error: "Invoice not found" }), {
						status: 404,
						headers: { "Content-Type": "application/json" },
					});
				}

				const actions = [];
				if (inv.status === "pending") {
					const provider = await getActiveProvider();
					actions.push({
						label: provider?.capabilities.checkout
							? "Pay Now"
							: "Payment Instructions",
						endpoint: `/api/my/invoices/${params.id}/pay`,
						method: "POST",
					});
				}

				return new Response(JSON.stringify({ actions }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			},
		},
	},
});
