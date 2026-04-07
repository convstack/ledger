import { createFileRoute } from "@tanstack/react-router";
import { db } from "~/db";
import { product } from "~/db/schema";
import { requireServiceOrStaff } from "~/lib/auth";

export const Route = createFileRoute("/api/products/$id/toggle")({
	server: {
		handlers: {
			/** @openapi
			 * summary: Toggle product active status
			 * auth: staff
			 * response: 200
			 *   success: boolean
			 * error: 401 Unauthorized
			 * error: 403 Forbidden
			 * error: 404 Product not found
			 */
			POST: async ({
				request,
				params,
			}: {
				request: Request;
				params: { id: string };
			}) => {
				const err = await requireServiceOrStaff(request);
				if (err) return err;

				const { eq, not } = await import("drizzle-orm");

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

				await db
					.update(product)
					.set({ active: !p.active, updatedAt: new Date() })
					.where(eq(product.id, params.id));

				return new Response(JSON.stringify({ success: true }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			},
		},
	},
});
