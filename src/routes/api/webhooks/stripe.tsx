import { createFileRoute } from "@tanstack/react-router";
import { nanoid } from "nanoid";
import { db } from "~/db";
import {
	invoice,
	ledgerAuditLog,
	ledgerProvider,
	payment,
	subscription,
} from "~/db/schema";
import { getActiveProvider } from "~/lib/providers/registry";
import { dispatchWebhook } from "~/lib/webhook-dispatcher";

export const Route = createFileRoute("/api/webhooks/stripe")({
	server: {
		handlers: {
			/** @openapi
			 * summary: Handle Stripe webhook events
			 * response: 200
			 *   received: boolean
			 * error: 400 Stripe provider not active
			 */
			POST: async ({ request }: { request: Request }) => {
				const provider = await getActiveProvider();
				if (
					!provider ||
					provider.type !== "stripe" ||
					!provider.handleWebhook
				) {
					return new Response(
						JSON.stringify({ error: "Stripe provider not active" }),
						{
							status: 400,
							headers: { "Content-Type": "application/json" },
						},
					);
				}

				const result = await provider.handleWebhook(request);
				if (!result.handled) {
					return new Response(JSON.stringify({ received: true }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				}

				const { eq } = await import("drizzle-orm");
				const now = new Date();

				// Invoice payment events
				if (result.action === "mark_paid" && result.invoiceId) {
					const [inv] = await db
						.select()
						.from(invoice)
						.where(eq(invoice.id, result.invoiceId))
						.limit(1);

					if (inv && inv.status !== "paid") {
						await db
							.update(invoice)
							.set({ status: "paid", paidAt: now, updatedAt: now })
							.where(eq(invoice.id, result.invoiceId));

						await db.insert(payment).values({
							id: nanoid(),
							invoiceId: result.invoiceId,
							amount: inv.total,
							currency: inv.currency,
							status: "succeeded",
							provider: "stripe",
							method: "card",
							createdAt: now,
						});

						await db.insert(ledgerAuditLog).values({
							id: nanoid(),
							action: "payment.succeeded",
							entityType: "invoice",
							entityId: result.invoiceId,
							userId: "stripe-webhook",
							details: { method: "stripe_checkout" },
							createdAt: now,
						});

						// Find the subscription linked to this user for the dispatch
						const [sub] = await db
							.select({
								id: subscription.id,
								providerRef: subscription.providerRef,
							})
							.from(subscription)
							.where(eq(subscription.userId, inv.userId))
							.limit(1);

						dispatchWebhook("subscription.paid", {
							invoiceId: result.invoiceId,
							userId: inv.userId,
							subscriptionId: sub?.id || null,
							providerRef: sub?.providerRef || null,
						});
					}
				}

				if (result.action === "mark_failed" && result.invoiceId) {
					await db
						.update(invoice)
						.set({ status: "failed", updatedAt: now })
						.where(eq(invoice.id, result.invoiceId));

					await db.insert(ledgerAuditLog).values({
						id: nanoid(),
						action: "payment.failed",
						entityType: "invoice",
						entityId: result.invoiceId,
						userId: "stripe-webhook",
						createdAt: now,
					});

					dispatchWebhook("subscription.payment_failed", {
						invoiceId: result.invoiceId,
					});
				}

				// Subscription created — update providerRef from checkout session ID to real subscription ID
				if (result.action === "subscription_created" && result.subscriptionId) {
					const data = result.data || {};
					const userId = data.userId as string | undefined;
					if (userId) {
						// Find the subscription by userId that still has a cs_ providerRef
						const [sub] = await db
							.select({ id: subscription.id })
							.from(subscription)
							.where(eq(subscription.userId, userId))
							.limit(1);
						if (sub) {
							// Get the active provider's ID
							const [activeProvider] = await db
								.select({ id: ledgerProvider.id })
								.from(ledgerProvider)
								.where(eq(ledgerProvider.active, true))
								.limit(1);

							await db
								.update(subscription)
								.set({
									providerRef: result.subscriptionId,
									providerId: activeProvider?.id || null,
									updatedAt: now,
								})
								.where(eq(subscription.id, sub.id));
						}
					}

					dispatchWebhook("subscription.created", {
						subscriptionId: result.subscriptionId,
						userId: data.userId,
					});
				}

				// Subscription events
				if (result.action === "subscription_updated" && result.subscriptionId) {
					const data = result.data || {};
					const updates: Record<string, unknown> = {
						updatedAt: now,
					};
					if (data.status) updates.status = data.status as string;
					if (data.currentPeriodEnd)
						updates.currentPeriodEnd = new Date(
							(data.currentPeriodEnd as number) * 1000,
						);
					if (data.cancelAtPeriodEnd !== undefined)
						updates.cancelAtPeriodEnd = data.cancelAtPeriodEnd as boolean;

					await db
						.update(subscription)
						.set(updates)
						.where(eq(subscription.providerRef, result.subscriptionId));

					dispatchWebhook("subscription.updated", {
						subscriptionId: result.subscriptionId,
						status: (data.status as string) || "unknown",
					});
				}

				if (result.action === "subscription_deleted" && result.subscriptionId) {
					await db
						.update(subscription)
						.set({
							status: "cancelled",
							cancelledAt: now,
							updatedAt: now,
						})
						.where(eq(subscription.providerRef, result.subscriptionId));

					await db.insert(ledgerAuditLog).values({
						id: nanoid(),
						action: "subscription.cancelled",
						entityType: "subscription",
						entityId: result.subscriptionId,
						userId: "stripe-webhook",
						createdAt: now,
					});

					dispatchWebhook("subscription.cancelled", {
						subscriptionId: result.subscriptionId,
					});
				}

				return new Response(JSON.stringify({ received: true }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			},
		},
	},
});
