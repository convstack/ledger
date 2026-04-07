import { createFileRoute } from "@tanstack/react-router";
import { nanoid } from "nanoid";
import { db } from "~/db";
import { ledgerAuditLog, subscription } from "~/db/schema";
import { requireServiceOrStaff } from "~/lib/auth";
import { getActiveProvider } from "~/lib/providers/registry";

export const Route = createFileRoute("/api/subscriptions/$id/cancel")({
	server: {
		handlers: {
			/** @openapi
			 * summary: Cancel a subscription (admin)
			 * auth: staff
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
				const err = await requireServiceOrStaff(request);
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

				if (sub.status === "cancelled") {
					return new Response(JSON.stringify({ error: "Already cancelled" }), {
						status: 400,
						headers: { "Content-Type": "application/json" },
					});
				}

				const provider = await getActiveProvider();
				if (provider?.cancelSubscription && sub.providerRef) {
					await provider.cancelSubscription(sub.providerRef);
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
