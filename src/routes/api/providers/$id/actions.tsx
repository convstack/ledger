import { createFileRoute } from "@tanstack/react-router";
import { db } from "~/db";
import { ledgerProvider } from "~/db/schema";
import { requireServiceOrPermission } from "~/lib/auth";

export const Route = createFileRoute("/api/providers/$id/actions")({
	server: {
		handlers: {
			/** @openapi
			 * summary: Get available actions for a provider
			 * auth: staff
			 * response: 200
			 *   actions: Array<{label: string, endpoint: string, method: string, variant?: string, confirm?: string}>
			 * error: 401 Unauthorized
			 * error: 403 Forbidden
			 * error: 404 Provider not found
			 */
			GET: async ({
				request,
				params,
			}: {
				request: Request;
				params: { id: string };
			}) => {
				const err = await requireServiceOrPermission(request, "ledger:manage");
				if (err) return err;

				const { eq } = await import("drizzle-orm");
				const [row] = await db
					.select({ active: ledgerProvider.active })
					.from(ledgerProvider)
					.where(eq(ledgerProvider.id, params.id))
					.limit(1);

				if (!row) {
					return new Response(JSON.stringify({ error: "Provider not found" }), {
						status: 404,
						headers: { "Content-Type": "application/json" },
					});
				}

				const actions = [];
				if (row.active) {
					actions.push({
						label: "Deactivate",
						endpoint: `/api/providers/${params.id}/deactivate`,
						method: "POST",
						variant: "danger",
						confirm: "Deactivate this provider?",
					});
				} else {
					actions.push({
						label: "Activate",
						endpoint: `/api/providers/${params.id}/activate`,
						method: "POST",
						variant: "default",
						confirm:
							"Activate this provider? This will deactivate any other active provider.",
					});
				}

				return new Response(JSON.stringify({ actions }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			},
		},
	},
});
