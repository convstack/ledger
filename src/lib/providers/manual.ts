import type {
	InvoiceRecord,
	LedgerProvider,
	PaymentInitiation,
	ProviderCapabilities,
	SettingsField,
} from "./types";

export class ManualProvider implements LedgerProvider {
	readonly type = "manual";
	readonly capabilities: ProviderCapabilities = {
		invoices: true,
		subscriptions: false,
		checkout: false,
		refunds: false,
		recurringBilling: false,
	};

	private settings: Record<string, string> = {};

	async initialize(settings: Record<string, string>): Promise<void> {
		this.settings = settings;
	}

	async createInvoice(
		_invoice: InvoiceRecord,
	): Promise<{ providerRef?: string }> {
		return {};
	}

	async initiatePayment(invoice: InvoiceRecord): Promise<PaymentInitiation> {
		const method = this.settings.paymentMethod || "iban";
		const amount = `${(invoice.total / 100).toFixed(2)} ${invoice.currency}`;
		const ref = `INV-${invoice.id.slice(0, 8).toUpperCase()}`;

		let instructions: string;

		switch (method) {
			case "iban": {
				const holder = this.settings.ibanHolder || "—";
				const iban = this.settings.ibanNumber || "—";
				const bank = this.settings.ibanBank || "";
				instructions = [
					`Please transfer **${amount}** to:`,
					"",
					`**Account holder:** ${holder}`,
					`**IBAN:** ${iban}`,
					bank ? `**Bank:** ${bank}` : "",
					"",
					`**Payment reference:** ${ref}`,
					"",
					"Your invoice will be marked as paid once the transfer is confirmed.",
				]
					.filter(Boolean)
					.join("\n");
				break;
			}
			case "cash":
				instructions = [
					`Please pay **${amount}** in cash at the registration desk.`,
					"",
					`**Payment reference:** ${ref}`,
					"",
					"Bring this reference number with you. Your invoice will be marked as paid on the spot.",
				].join("\n");
				break;
			case "custom":
				instructions =
					this.settings.customInstructions ||
					"Please contact the organizer for payment instructions.";
				instructions = instructions
					.replace("{amount}", amount)
					.replace("{reference}", ref)
					.replace("{invoiceId}", invoice.id);
				break;
			default:
				instructions = `Please pay ${amount}. Reference: ${ref}`;
		}

		return { type: "instructions", instructions };
	}

	async markPaid(
		_invoice: InvoiceRecord,
		_paymentDetails?: Record<string, string>,
	): Promise<void> {
		// No-op — admin marks it manually via the admin UI or API
	}

	validateSettings(settings: Record<string, string>): {
		valid: boolean;
		errors?: string[];
	} {
		const errors: string[] = [];
		const method = settings.paymentMethod;

		if (!method) {
			errors.push("Payment method is required");
		} else if (method === "iban") {
			if (!settings.ibanNumber) errors.push("IBAN number is required");
			if (!settings.ibanHolder) errors.push("Account holder name is required");
		} else if (method === "custom") {
			if (!settings.customInstructions)
				errors.push("Custom instructions are required");
		}

		return { valid: errors.length === 0, errors };
	}

	getSettingsSchema(): SettingsField[] {
		return [
			{
				key: "paymentMethod",
				label: "Payment Method",
				type: "select",
				required: true,
				options: [
					{ label: "Bank Transfer (IBAN)", value: "iban" },
					{ label: "Cash", value: "cash" },
					{ label: "Custom", value: "custom" },
				],
			},
			{
				key: "ibanHolder",
				label: "Account Holder",
				type: "text",
				placeholder: "e.g. Convention Org e.V.",
			},
			{
				key: "ibanNumber",
				label: "IBAN",
				type: "text",
				placeholder: "e.g. DE89 3704 0044 0532 0130 00",
			},
			{
				key: "ibanBank",
				label: "Bank Name",
				type: "text",
				placeholder: "e.g. Commerzbank",
			},
			{
				key: "customInstructions",
				label: "Custom Payment Instructions",
				type: "textarea",
				placeholder:
					"Use {amount} for the total, {reference} for the invoice reference.",
			},
		];
	}
}
