export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  APPROVED = 'APPROVED',
  FINANCING_REQUESTED = 'FINANCING_REQUESTED',
  FINANCED = 'FINANCED',
  PAID = 'PAID',
  REJECTED = 'REJECTED',
}

export enum FinancingErrorCode {
  INVOICE_NOT_APPROVED = 'INVOICE_NOT_APPROVED',
  OFFER_EXPIRED = 'OFFER_EXPIRED',
  FORBIDDEN = 'FORBIDDEN',
  UNKNOWN = 'UNKNOWN',
}

export type FinancingEligibleStatus =
  | InvoiceStatus.APPROVED
  | InvoiceStatus.FINANCING_REQUESTED;

export interface FinancingOfferUi {
  discountRate: number;
  netAmount: number;
  expiresAt: string;
}

interface InvoiceBaseUi {
  id: string;
  invoiceNumber: string;
  supplierName: string;
  buyerName: string;
  amount: number;
  currency: string;
  dueDate: string;
}

export interface EligibleInvoiceUi extends InvoiceBaseUi {
  status: FinancingEligibleStatus;
  financingOffer: FinancingOfferUi;
}

export interface OtherInvoiceUi extends InvoiceBaseUi {
  status: Exclude<InvoiceStatus, FinancingEligibleStatus>;
  financingOffer?: never;
}

export type InvoiceUi = EligibleInvoiceUi | OtherInvoiceUi;

declare const requestableBrand: unique symbol;

// A RequestableInvoiceUi is an APPROVED invoice that a caller has proven
// (via `toRequestable`) is safe to pass to the store's financing command.
// The brand makes the type un-forgeable — you cannot cast into it, only earn it.
export type RequestableInvoiceUi = EligibleInvoiceUi & {
  readonly status: InvoiceStatus.APPROVED;
  readonly [requestableBrand]: 'Requestable';
};

export function toRequestable(invoice: InvoiceUi): RequestableInvoiceUi | null {
  return invoice.status === InvoiceStatus.APPROVED
    ? (invoice as RequestableInvoiceUi)
    : null;
}

export interface InvoiceFilterUi {
  status: InvoiceStatus | null;
  search: string;
}

// A row projection for list rendering: pairs an invoice with its
// (permission-gated) requestable form and offer view. Both `requestable` and
// `offer` are null when the user lacks `supplier:financing`; `offer` is also
// null on non-eligible statuses.
export interface InvoiceRowUi {
  invoice: InvoiceUi;
  requestable: RequestableInvoiceUi | null;
  offer: FinancingOfferUi | null;
}
