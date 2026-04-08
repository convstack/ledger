import { createFileRoute } from "@tanstack/react-router";
import { nanoid } from "nanoid";
import { db } from "~/db";
import { ledgerAuditLog, subscription } from "~/db/schema";
import { requireServiceOrPermission } from "~/lib/auth";
import { getActiveProvider } from "~/lib/providers/registry";

export const Route = createFileRoute("/api/subscriptions/$id/reactivate")({
	server: {
		handlers: {
			/** @openapi
			 * summary: Reactivate a cancelled subscription
			 * auth: staff
			 * response: 200
			 *   success: boolean
			 * error: 400 Subscription is already active
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
				const err = await requireServiceOrPermission(request, "ledger:manage");
				if (err) return err;

				const { eq } = await import("drizzle-orm");

				const [sub] = await db
					.select()
					.from(subscription)
					.where(eq(subscription.id, params.id))
					.limit(1);

				if (!sub) {
					return new Response(
						JSON.stringify({ error: "Subscription not found" }),
						{
							status: 404,
							headers: { "Content-Type": "application/json" },
						},
					);
				}

				if (sub.status === "active" && !sub.cancelAtPeriodEnd) {
					return new Response(
						JSON.stringify({
							error: "Subscription is already active",
						}),
						{
							status: 400,
							headers: { "Content-Type": "application/json" },
						},
					);
				}

				// Undo cancellation via Stripe if applicable
				if (sub.providerRef) {
					const provider = await getActiveProvider();
					if (provider?.type === "stripe") {
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
							if (settings.secretKey) {
								const stripe = new Stripe(settings.secretKey);
								// Resolve cs_ session ID to real sub_ ID if needed
								let subRef = sub.providerRef;
								if (subRef.startsWith("cs_")) {
									const session =
										await stripe.checkout.sessions.retrieve(subRef);
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
								await stripe.subscriptions.update(subRef, {
									cancel_at_period_end: false,
								});
							}
						}
					}
				}

				const now = new Date();
				await db
					.update(subscription)
					.set({
						status: "active",
						cancelAtPeriodEnd: false,
						cancelledAt: null,
						updatedAt: now,
					})
					.where(eq(subscription.id, params.id));

				await db.insert(ledgerAuditLog).values({
					id: nanoid(),
					action: "subscription.reactivated",
					entityType: "subscription",
					entityId: params.id,
					userId: "admin",
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
