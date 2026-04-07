import type {
	InvoiceRecord,
	LedgerProvider,
	PaymentInitiation,
	ProviderCapabilities,
	SettingsField,
} from "./types";

/**
 * Stub provider for development/testing. Does nothing real.
 */
export class StubProvider implements LedgerProvider {
	readonly type = "stub";
	readonly capabilities: ProviderCapabilities = {
		invoices: true,
		subscriptions: false,
		checkout: false,
		refunds: false,
		recurringBilling: false,
	};

	async initialize(): Promise<void> {}

	async createInvoice(
		_invoice: InvoiceRecord,
	): Promise<{ providerRef?: string }> {
		return {};
	}

	async initiatePayment(_invoice: InvoiceRecord): Promise<PaymentInitiation> {
		return {
			type: "instructions",
			instructions: "This is a stub provider. No real payment processing.",
		};
	}

	async markPaid(): Promise<void> {}

	validateSettings(): { valid: boolean; errors?: string[] } {
		return { valid: true };
	}

	getSettingsSchema(): SettingsField[] {
		return [];
	}
}
