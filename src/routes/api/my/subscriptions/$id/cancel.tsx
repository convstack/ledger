import { createFileRoute } from "@tanstack/react-router";
import { nanoid } from "nanoid";
import { db } from "~/db";
import { ledgerAuditLog, subscription } from "~/db/schema";
import { getRequestUser } from "~/lib/auth";
import { getActiveProvider } from "~/lib/providers/registry";

export const Route = createFileRoute("/api/my/subscriptions/$id/cancel")({
	server: {
		handlers: {
			/** @openapi
			 * summary: Cancel own subscription
			 * auth: user
			 * response: 200
			 *   success: boolean
			 * error: 400 Already cancelled
			 * error: 401 Unauthorized
			 * error: 404 Subscription not found
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

				const [sub] = await db
					.select()
					.from(subscription)
					.where(
						and(
							eq(subscription.id, params.id),
							eq(subscription.userId, user.id),
						),
					)
					.limit(1);

				if (!sub) {
					return new Response(
						JSON.stringify({ error: "Subscription not found" }),
						{ status: 404, headers: { "Content-Type": "application/json" } },
					);
				}

				if (sub.status === "cancelled") {
					return new Response(JSON.stringify({ error: "Already cancelled" }), {
						status: 400,
						headers: { "Content-Type": "application/json" },
					});
				}

				// Cancel with the provider if possible
				const provider = await getActiveProvider();
				if (provider?.cancelSubscription && sub.providerRef) {
					let subRef = sub.providerRef;
					// Resolve cs_ checkout session ID to real sub_ subscription ID
					if (subRef.startsWith("cs_") && provider.type === "stripe") {
						const Stripe = (await import("stripe")).default;
						const { decryptSettings } = await import("~/lib/crypto");
						const { ledgerProvider } = await import("~/db/schema");
						const [active] = await db
							.select({ settings: ledgerProvider.settings })
							.from(ledgerProvider)
							.where(eq(ledgerProvider.active, true))
							.limit(1);
						if (active?.settings) {
							const settings = decryptSettings(active.settings);
							const stripe = new Stripe(settings.secretKey);
							const session = await stripe.checkout.sessions.retrieve(subRef);
							if (session.subscription) {
								subRef =
									typeof session.subscription === "string"
										? session.subscription
										: session.subscription.id;
								await db
									.update(subscription)
									.set({ providerRef: subRef })
									.where(eq(subscription.id, params.id));
							}
						}
					}
					await provider.cancelSubscription(subRef);
				}

				const now = new Date();
				await db
					.update(subscription)
					.set({
						cancelAtPeriodEnd: true,
						cancelledAt: now,
						updatedAt: now,
					})
					.where(eq(subscription.id, params.id));

				await db.insert(ledgerAuditLog).values({
					id: nanoid(),
					action: "subscription.cancelled",
					entityType: "subscription",
					entityId: params.id,
					userId: user.id,
					createdAt: now,
				});

				return new Response(JSON.stringify({ success: true }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			},
		},
	},
});
