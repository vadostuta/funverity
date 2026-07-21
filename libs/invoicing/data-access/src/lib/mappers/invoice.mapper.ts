import {
  EligibleInvoiceUi,
  FinancingEligibleStatus,
  FinancingOfferUi,
  InvoiceStatus,
  InvoiceUi,
  OtherInvoiceUi,
} from '@org/invoicing/domain';
import type {
  FinancingErrorDto,
  FinancingOfferDto,
  FinancingRequestedDto,
  InvoiceDto,
  RequestFinancingResultDto,
} from '../models/invoice.dto';

export interface FinancingRequestedUi {
  __typename: 'FinancingRequested';
  invoice: InvoiceUi;
}

export type RequestFinancingResultUi = FinancingRequestedUi | FinancingErrorDto;

export class InvoiceMapper {
  static toFinancingOfferUi(dto: FinancingOfferDto): FinancingOfferUi {
    return {
      discountRate: dto.discountRate,
      netAmount: dto.netAmount,
      expiresAt: dto.expiresAt,
    };
  }

  static toInvoiceUi(dto: InvoiceDto): InvoiceUi {
    const isEligible =
      dto.status === InvoiceStatus.APPROVED ||
      dto.status === InvoiceStatus.FINANCING_REQUESTED;

    if (isEligible && dto.financingOffer) {
      return {
        id: dto.id,
        invoiceNumber: dto.invoiceNumber,
        supplierName: dto.supplierName,
        buyerName: dto.buyerName,
        amount: dto.amount,
        currency: dto.currency,
        dueDate: dto.dueDate,
        status: dto.status as FinancingEligibleStatus,
        financingOffer: this.toFinancingOfferUi(dto.financingOffer),
      } satisfies EligibleInvoiceUi;
    }

    return {
      id: dto.id,
      invoiceNumber: dto.invoiceNumber,
      supplierName: dto.supplierName,
      buyerName: dto.buyerName,
      amount: dto.amount,
      currency: dto.currency,
      dueDate: dto.dueDate,
      status: dto.status as Exclude<InvoiceStatus, FinancingEligibleStatus>,
    } satisfies OtherInvoiceUi;
  }

  static toInvoicesUi(dtos: InvoiceDto[]): InvoiceUi[] {
    return dtos.map((dto) => this.toInvoiceUi(dto));
  }

  static toRequestFinancingResultUi(
    dto: RequestFinancingResultDto,
  ): RequestFinancingResultUi {
    if (dto.__typename === 'FinancingRequested') {
      return {
        __typename: 'FinancingRequested',
        invoice: this.toInvoiceUi((dto as FinancingRequestedDto).invoice),
      };
    }
    return dto;
  }
}
