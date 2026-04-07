import { createFileRoute } from "@tanstack/react-router";
import { nanoid } from "nanoid";
import { db } from "~/db";
import { invoice, ledgerAuditLog } from "~/db/schema";
import { getRequestUser, requireServiceOrStaff } from "~/lib/auth";

export const Route = createFileRoute("/api/invoices/$id/cancel")({
	server: {
		handlers: {
			/** @openapi
			 * summary: Cancel an invoice
			 * auth: staff
			 * response: 200
			 *   success: boolean
			 * error: 400 Cannot cancel a paid invoice
			 * error: 401 Unauthorized
			 * error: 403 Forbidden
			 * error: 404 Invoice not found
			 */
			POST: async ({
				request,
				params,
			}: {
				request: Request;
				params: { id: string };
			}) => {
				const user = getRequestUser(request);
				const err = await requireServiceOrStaff(request);
				if (err) return err;

				const { eq } = await import("drizzle-orm");

				const [inv] = await db
					.select({ status: invoice.status })
					.from(invoice)
					.where(eq(invoice.id, params.id))
					.limit(1);

				if (!inv) {
					return new Response(JSON.stringify({ error: "Invoice not found" }), {
						status: 404,
						headers: { "Content-Type": "application/json" },
					});
				}

				if (inv.status === "paid") {
					return new Response(
						JSON.stringify({ error: "Cannot cancel a paid invoice" }),
						{ status: 400, headers: { "Content-Type": "application/json" } },
					);
				}

				const now = new Date();
				await db
					.update(invoice)
					.set({ status: "cancelled", updatedAt: now })
					.where(eq(invoice.id, params.id));

				await db.insert(ledgerAuditLog).values({
					id: nanoid(),
					action: "invoice.cancelled",
					entityType: "invoice",
					entityId: params.id,
					userId: user?.id || "service",
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
