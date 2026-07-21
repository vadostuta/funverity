import { FinancingErrorCode, InvoiceStatus } from '@org/invoicing/domain';

export interface FinancingOfferDto {
  discountRate: number;
  netAmount: number;
  expiresAt: string;
}

export interface InvoiceDto {
  id: string;
  invoiceNumber: string;
  supplierName: string;
  buyerName: string;
  amount: number;
  currency: string;
  dueDate: string;
  status: InvoiceStatus;
  financingOffer?: FinancingOfferDto | null;
}

export interface InvoiceFilterDto {
  status?: InvoiceStatus | null;
  search?: string;
}

export interface FinancingRequestedDto {
  __typename: 'FinancingRequested';
  invoice: InvoiceDto;
}

export interface FinancingErrorDto {
  __typename: 'FinancingError';
  code: FinancingErrorCode;
  message: string;
}

export type RequestFinancingResultDto = FinancingRequestedDto | FinancingErrorDto;
