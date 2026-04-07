import { createFileRoute } from "@tanstack/react-router";
import { db } from "~/db";
import { product } from "~/db/schema";
import { getRequestUser, requireLedgerManage } from "~/lib/auth";

export const Route = createFileRoute("/api/products/$id/actions")({
	server: {
		handlers: {
			/** @openapi
			 * summary: Get available actions for a product
			 * auth: staff
			 * response: 200
			 *   actions: Array<{label: string, endpoint: string, method: string, variant?: string, confirm?: string}>
			 * error: 401 Unauthorized
			 * error: 403 Forbidden
			 * error: 404 Product not found
			 */
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
				const [p] = await db
					.select({ active: product.active })
					.from(product)
					.where(eq(product.id, params.id))
					.limit(1);

				if (!p) {
					return new Response(JSON.stringify({ error: "Product not found" }), {
						status: 404,
						headers: { "Content-Type": "application/json" },
					});
				}

				const actions = [];
				if (p.active) {
					actions.push({
						label: "Deactivate",
						endpoint: `/api/products/${params.id}/toggle`,
						method: "POST",
						variant: "danger",
						confirm: "Deactivate this product?",
					});
				} else {
					actions.push({
						label: "Activate",
						endpoint: `/api/products/${params.id}/toggle`,
						method: "POST",
						confirm: "Activate this product?",
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
