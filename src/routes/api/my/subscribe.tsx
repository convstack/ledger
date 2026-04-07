import { createFileRoute } from "@tanstack/react-router";
import { nanoid } from "nanoid";
import { db } from "~/db";
import { ledgerAuditLog, product, subscription } from "~/db/schema";
import { getRequestUser } from "~/lib/auth";
import { getActiveProvider } from "~/lib/providers/registry";

export const Route = createFileRoute("/api/my/subscribe")({
	server: {
		handlers: {
			/** @openapi
			 * summary: Subscribe to a recurring product
			 * auth: user
			 * body:
			 *   productId: string (required) - ID of the recurring product to subscribe to
			 * response: 201
			 *   success: boolean
			 *   id: string
			 * response: 200
			 *   redirect: string
			 * error: 400 Invalid JSON
			 * error: 400 productId is required
			 * error: 400 Only recurring products can be subscribed to
			 * error: 401 Unauthorized
			 * error: 404 Product not found or inactive
			 * error: 501 Active provider does not support subscriptions
			 */
			POST: async ({ request }: { request: Request }) => {
				const user = getRequestUser(request);
				if (!user) {
					return new Response(JSON.stringify({ error: "Unauthorized" }), {
						status: 401,
						headers: { "Content-Type": "application/json" },
					});
				}

				let body: { productId: string };
				try {
					body = await request.json();
				} catch {
					return new Response(JSON.stringify({ error: "Invalid JSON" }), {
						status: 400,
						headers: { "Content-Type": "application/json" },
					});
				}

				if (!body.productId) {
					return new Response(
						JSON.stringify({ error: "productId is required" }),
						{
							status: 400,
							headers: { "Content-Type": "application/json" },
						},
					);
				}

				const { eq } = await import("drizzle-orm");

				const [prod] = await db
					.select()
					.from(product)
					.where(eq(product.id, body.productId))
					.limit(1);

				if (!prod?.active) {
					return new Response(
						JSON.stringify({ error: "Product not found or inactive" }),
						{
							status: 404,
							headers: { "Content-Type": "application/json" },
						},
					);
				}

				if (prod.type !== "recurring") {
					return new Response(
						JSON.stringify({
							error: "Only recurring products can be subscribed to",
						}),
						{
							status: 400,
							headers: { "Content-Type": "application/json" },
						},
					);
				}

				const provider = await getActiveProvider();
				if (
					!provider?.capabilities.subscriptions ||
					!provider.createSubscription
				) {
					return new Response(
						JSON.stringify({
							error: "Active provider does not support subscriptions",
						}),
						{
							status: 501,
							headers: { "Content-Type": "application/json" },
						},
					);
				}

				const result = await provider.createSubscription({
					userId: user.id,
					productId: prod.id,
					priceId: prod.stripePriceId || undefined,
					prorateOnChange: prod.prorateOnChange,
				});

				const now = new Date();
				const subId = nanoid();

				await db.insert(subscription).values({
					id: subId,
					userId: user.id,
					productId: prod.id,
					status: "active",
					providerRef: result.providerRef,
					currentPeriodEnd: result.currentPeriodEnd,
					currentPeriodStart: now,
					createdAt: now,
					updatedAt: now,
				});

				await db.insert(ledgerAuditLog).values({
					id: nanoid(),
					action: "subscription.created",
					entityType: "subscription",
					entityId: subId,
					userId: user.id,
					details: { productId: prod.id },
					createdAt: now,
				});

				// If the provider returned a checkout redirect (Stripe), return it
				if (result.providerRef?.startsWith("cs_")) {
					return new Response(
						JSON.stringify({
							redirect: `${process.env.DASHBOARD_URL || "http://localhost:4000"}/ledger/my/subscriptions`,
						}),
						{
							status: 200,
							headers: { "Content-Type": "application/json" },
						},
					);
				}

				return new Response(JSON.stringify({ success: true, id: subId }), {
					status: 201,
					headers: { "Content-Type": "application/json" },
				});
			},
		},
	},
});
