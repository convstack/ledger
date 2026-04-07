import { createFileRoute } from "@tanstack/react-router";
import { nanoid } from "nanoid";
import { db } from "~/db";
import { product } from "~/db/schema";
import { getRequestUser, requireLedgerManage } from "~/lib/auth";

export const Route = createFileRoute("/api/products")({
	server: {
		handlers: {
			/** @openapi
			 * summary: List all products
			 * auth: staff
			 * response: 200
			 *   columns: Array<{key: string, label: string}>
			 *   rows: Array<{id: string, name: string, amount: string, type: string, status: string}>
			 *   total: number
			 * error: 401 Unauthorized
			 * error: 403 Forbidden
			 */
			GET: async ({ request }: { request: Request }) => {
				const user = getRequestUser(request);
				const err = requireLedgerManage(user);
				if (err) return err;

				const { desc } = await import("drizzle-orm");

				const rows = await db
					.select({
						id: product.id,
						name: product.name,
						price: product.price,
						currency: product.currency,
						type: product.type,
						active: product.active,
					})
					.from(product)
					.orderBy(desc(product.createdAt));

				return new Response(
					JSON.stringify({
						columns: [
							{ key: "name", label: "Name" },
							{ key: "amount", label: "Price" },
							{ key: "type", label: "Type" },
							{ key: "status", label: "Status" },
						],
						rows: rows.map((r) => ({
							id: r.id,
							name: r.name,
							amount: `${(r.price / 100).toFixed(2)} ${r.currency}`,
							type: r.type,
							status: r.active ? "Active" : "Inactive",
						})),
						total: rows.length,
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				);
			},

			/** @openapi
			 * summary: Create a new product
			 * auth: staff
			 * body:
			 *   name: string (required) - Product name
			 *   price: string (required) - Price in cents
			 *   type: string (required) - Product type (e.g. one_time, recurring)
			 *   description: string - Product description
			 *   currency: string - Currency code, defaults to EUR
			 *   interval: string - Billing interval for recurring products
			 *   prorateOnChange: string - Whether to prorate on plan changes
			 * response: 201
			 *   success: boolean
			 *   redirect: string
			 * error: 400 Invalid JSON
			 * error: 400 Validation error
			 * error: 401 Unauthorized
			 * error: 403 Forbidden
			 */
			POST: async ({ request }: { request: Request }) => {
				const user = getRequestUser(request);
				const err = requireLedgerManage(user);
				if (err) return err;

				const { getActiveProvider } = await import("~/lib/providers/registry");

				let body: {
					name?: string;
					description?: string;
					price?: string;
					currency?: string;
					type?: string;
					interval?: string;
					prorateOnChange?: string;
				};
				try {
					body = await request.json();
				} catch {
					return new Response(JSON.stringify({ error: "Invalid JSON" }), {
						status: 400,
						headers: { "Content-Type": "application/json" },
					});
				}

				if (!body.name || !body.price || !body.type) {
					return new Response(
						JSON.stringify({
							error: "Name, price, and type are required",
						}),
						{
							status: 400,
							headers: { "Content-Type": "application/json" },
						},
					);
				}

				const id = nanoid();
				const currency = body.currency || "EUR";
				const prorate =
					body.prorateOnChange === "true" || body.prorateOnChange === "on";

				let stripeProductId: string | null = null;
				let stripePriceId: string | null = null;

				// Sync with active provider if it supports product sync
				const provider = await getActiveProvider();
				if (provider?.syncProduct) {
					try {
						const synced = await provider.syncProduct({
							id,
							name: body.name,
							description: body.description,
							price: Number(body.price),
							currency,
							type: body.type,
							interval: body.interval,
						});
						stripeProductId = synced.productId || null;
						stripePriceId = synced.priceId || null;
					} catch (syncErr) {
						console.warn("Product sync failed:", syncErr);
					}
				}

				await db.insert(product).values({
					id,
					name: body.name,
					description: body.description || null,
					price: Number(body.price),
					currency,
					type: body.type,
					interval: body.interval || null,
					prorateOnChange: prorate,
					stripeProductId,
					stripePriceId,
					createdAt: new Date(),
					updatedAt: new Date(),
				});

				return new Response(
					JSON.stringify({
						success: true,
						redirect: `/ledger/products/${id}`,
					}),
					{
						status: 201,
						headers: { "Content-Type": "application/json" },
					},
				);
			},
		},
	},
});
