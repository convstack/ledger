import { createFileRoute } from "@tanstack/react-router";
import { db } from "~/db";
import { ledgerProvider } from "~/db/schema";
import { getRequestUser, requireLedgerManage } from "~/lib/auth";

export const Route = createFileRoute("/api/providers/$id/actions")({
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
