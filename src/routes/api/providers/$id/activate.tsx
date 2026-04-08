import { createFileRoute } from "@tanstack/react-router";
import { db } from "~/db";
import { ledgerProvider } from "~/db/schema";
import { requireServiceOrPermission } from "~/lib/auth";

export const Route = createFileRoute("/api/providers/$id/activate")({
	server: {
		handlers: {
			/** @openapi
			 * summary: Activate a provider and deactivate all others
			 * auth: staff
			 * response: 200
			 *   success: boolean
			 * error: 401 Unauthorized
			 * error: 403 Forbidden
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

				// Deactivate all providers first
				await db
					.update(ledgerProvider)
					.set({ active: false, updatedAt: new Date() });

				// Activate this one
				await db
					.update(ledgerProvider)
					.set({ active: true, updatedAt: new Date() })
					.where(eq(ledgerProvider.id, params.id));

				return new Response(JSON.stringify({ success: true }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			},
		},
	},
});
