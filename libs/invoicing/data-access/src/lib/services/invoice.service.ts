import { inject, Injectable } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { GET_INVOICES, REQUEST_FINANCING } from '../graphql/operations';
import {
  InvoiceDto,
  InvoiceFilterDto,
  RequestFinancingResultDto,
} from '../models/invoice.dto';

interface GetInvoicesData {
  invoices: InvoiceDto[];
}

interface RequestFinancingData {
  requestFinancing: RequestFinancingResultDto;
}

@Injectable({ providedIn: 'root' })
export class InvoiceService {
  private readonly apollo = inject(Apollo);

  getInvoices(invoiceFilter?: InvoiceFilterDto): Observable<InvoiceDto[]> {
    return this.apollo
      .watchQuery<GetInvoicesData>({
        query: GET_INVOICES,
        variables: { filter: invoiceFilter },
      })
      .valueChanges.pipe(
        filter(({ data }) => !!data?.invoices),
        map(({ data }) => (data as GetInvoicesData).invoices),
      );
  }

  requestFinancing(invoiceId: string): Observable<RequestFinancingResultDto> {
    return this.apollo
      .mutate<RequestFinancingData>({
        mutation: REQUEST_FINANCING,
        variables: { invoiceId },
      })
      .pipe(
        map(({ data }) => {
          if (!data) throw new Error('requestFinancing returned no data');
          return data.requestFinancing;
        }),
      );
  }
}
