export interface RequestUser {
	id: string;
	role: string;
	email: string;
}

export function getRequestUser(request: Request): RequestUser | null {
	const id = request.headers.get("x-user-id");
	const role = request.headers.get("x-user-role") || "user";
	const email = request.headers.get("x-user-email") || "";
	if (!id) return null;
	return { id, role, email };
}

export function requireStaff(user: RequestUser | null): Response | null {
	if (!user) {
		return new Response(JSON.stringify({ error: "Unauthorized" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		});
	}
	if (user.role !== "staff" && user.role !== "admin") {
		return new Response(JSON.stringify({ error: "Staff access required" }), {
			status: 403,
			headers: { "Content-Type": "application/json" },
		});
	}
	return null;
}

/**
 * Require ledger:manage permission (staff or admin role).
 */
export function requireLedgerManage(user: RequestUser | null): Response | null {
	return requireStaff(user);
}

// Cache verified service keys for 5 minutes
const verifiedKeys = new Map<string, { valid: boolean; expires: number }>();
const KEY_CACHE_TTL = 5 * 60 * 1000;

/**
 * Validate a ServiceKey by forwarding it to Lanyard's heartbeat endpoint.
 * Caches results for 5 minutes to avoid hitting Lanyard on every request.
 */
export async function validateServiceKey(request: Request): Promise<boolean> {
	const auth = request.headers.get("authorization");
	if (!auth?.startsWith("ServiceKey ")) return false;

	const cached = verifiedKeys.get(auth);
	if (cached && cached.expires > Date.now()) {
		return cached.valid;
	}

	const lanyardUrl = process.env.LANYARD_URL || "http://localhost:3000";

	try {
		const res = await fetch(`${lanyardUrl}/api/services/heartbeat`, {
			method: "POST",
			headers: {
				Authorization: auth,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ status: "healthy" }),
			signal: AbortSignal.timeout(3000),
		});

		const valid = res.ok;
		verifiedKeys.set(auth, {
			valid,
			expires: Date.now() + KEY_CACHE_TTL,
		});
		return valid;
	} catch {
		return false;
	}
}

/**
 * Require a valid ServiceKey. Returns an error Response if invalid, null if valid.
 */
export async function requireServiceKey(
	request: Request,
): Promise<Response | null> {
	const valid = await validateServiceKey(request);
	if (!valid) {
		return new Response(
			JSON.stringify({ error: "Invalid or missing ServiceKey" }),
			{ status: 401, headers: { "Content-Type": "application/json" } },
		);
	}
	return null;
}
