import { createFileRoute } from "@tanstack/react-router";
import { db } from "~/db";
import { ledgerProvider } from "~/db/schema";
import { requireServiceOrStaff } from "~/lib/auth";

export const Route = createFileRoute("/api/providers/$id/deactivate")({
	server: {
		handlers: {
			/** @openapi
			 * summary: Deactivate a provider
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
				const err = await requireServiceOrStaff(request);
				if (err) return err;

				const { eq } = await import("drizzle-orm");

				await db
					.update(ledgerProvider)
					.set({ active: false, updatedAt: new Date() })
					.where(eq(ledgerProvider.id, params.id));

				return new Response(JSON.stringify({ success: true }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			},
		},
	},
});
