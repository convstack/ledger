import { createFileRoute } from "@tanstack/react-router";
import { db } from "~/db";
import { product } from "~/db/schema";
import { getRequestUser, requireLedgerManage } from "~/lib/auth";

export const Route = createFileRoute("/api/products/$id")({
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
				const [p] = await db
					.select()
					.from(product)
					.where(eq(product.id, params.id))
					.limit(1);

				if (!p) {
					return new Response(JSON.stringify({ error: "Product not found" }), {
						status: 404,
						headers: { "Content-Type": "application/json" },
					});
				}

				return new Response(
					JSON.stringify({
						fields: [
							{ key: "name", label: "Name", value: p.name },
							{
								key: "description",
								label: "Description",
								value: p.description || "—",
							},
							{
								key: "price",
								label: "Price (cents)",
								value: p.price,
							},
							{ key: "currency", label: "Currency", value: p.currency },
							{ key: "type", label: "Type", value: p.type },
							{
								key: "interval",
								label: "Interval",
								value: p.interval || "—",
							},
							{ key: "active", label: "Active", value: p.active },
							{
								key: "createdAt",
								label: "Created",
								value: p.createdAt?.toISOString() || "",
							},
						],
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				);
			},

			PUT: async ({
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

				const [existing] = await db
					.select({ id: product.id })
					.from(product)
					.where(eq(product.id, params.id))
					.limit(1);

				if (!existing) {
					return new Response(JSON.stringify({ error: "Product not found" }), {
						status: 404,
						headers: { "Content-Type": "application/json" },
					});
				}

				let body: Record<string, string>;
				try {
					body = await request.json();
				} catch {
					return new Response(JSON.stringify({ error: "Invalid JSON" }), {
						status: 400,
						headers: { "Content-Type": "application/json" },
					});
				}

				const updates: Record<string, unknown> = {
					updatedAt: new Date(),
				};
				if (body.name) updates.name = body.name;
				if (body.description !== undefined)
					updates.description = body.description || null;
				if (body.price) updates.price = Number(body.price);
				if (body.currency) updates.currency = body.currency;
				if (body.type) updates.type = body.type;
				if (body.interval !== undefined)
					updates.interval = body.interval || null;

				await db.update(product).set(updates).where(eq(product.id, params.id));

				return new Response(JSON.stringify({ success: true }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			},
		},
	},
});
