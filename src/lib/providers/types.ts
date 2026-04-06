export interface ProviderCapabilities {
	invoices: boolean;
	subscriptions: boolean;
	checkout: boolean;
	refunds: boolean;
	recurringBilling: boolean;
}

export interface PaymentInitiation {
	type: "redirect" | "instructions";
	redirectUrl?: string;
	instructions?: string;
	providerRef?: string;
}

export interface SettingsField {
	key: string;
	label: string;
	type: "text" | "password" | "textarea" | "select";
	required?: boolean;
	placeholder?: string;
	options?: Array<{ label: string; value: string }>;
}

export interface InvoiceRecord {
	id: string;
	userId: string;
	total: number;
	currency: string;
	items: Array<{
		description: string;
		quantity: number;
		unitPrice: number;
		total: number;
	}>;
	providerRef?: string | null;
}

export interface CreateSubscriptionParams {
	userId: string;
	productId: string;
	priceId?: string;
	prorateOnChange?: boolean;
}

export interface ChangeSubscriptionParams {
	subscriptionRef: string;
	newPriceId: string;
	prorate: boolean;
}

export interface WebhookResult {
	handled: boolean;
	invoiceId?: string;
	subscriptionId?: string;
	action?: string;
	data?: Record<string, unknown>;
}

export interface LedgerProvider {
	readonly type: string;
	readonly capabilities: ProviderCapabilities;

	initialize(settings: Record<string, string>): Promise<void>;

	createInvoice(invoice: InvoiceRecord): Promise<{ providerRef?: string }>;

	initiatePayment(invoice: InvoiceRecord): Promise<PaymentInitiation>;

	markPaid(
		invoice: InvoiceRecord,
		paymentDetails?: Record<string, string>,
	): Promise<void>;

	refundPayment?(invoice: InvoiceRecord): Promise<void>;

	syncProduct?(product: {
		id: string;
		name: string;
		description?: string | null;
		price: number;
		currency: string;
		type: string;
		interval?: string | null;
	}): Promise<{ productId?: string; priceId?: string }>;

	createSubscription?(
		params: CreateSubscriptionParams,
	): Promise<{ providerRef: string; currentPeriodEnd: Date }>;

	changeSubscription?(
		params: ChangeSubscriptionParams,
	): Promise<{ currentPeriodEnd: Date }>;

	cancelSubscription?(providerRef: string): Promise<void>;

	handleWebhook?(request: Request): Promise<WebhookResult>;

	validateSettings(settings: Record<string, string>): {
		valid: boolean;
		errors?: string[];
	};

	getSettingsSchema(): SettingsField[];
}
