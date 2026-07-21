import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
} from '@angular/core';
import {
  InvoiceRowUi,
  InvoiceStatus,
  RequestableInvoiceUi,
} from '@org/invoicing/domain';
import { InvoicingStore } from '@org/invoicing/data-access';
import {
  InvoiceFiltersComponent,
  InvoiceListComponent,
} from '@org/invoicing/ui';

@Component({
  selector: 'lib-invoicing-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [InvoiceFiltersComponent, InvoiceListComponent],
  templateUrl: './invoicing-list.container.html',
  styles: `
    .invoicing-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
  `,
})
export class InvoicingListContainer implements OnInit {
  protected readonly store = inject(InvoicingStore);

  protected readonly rows = computed<InvoiceRowUi[]>(() => {
    const requestables = new Map(
      this.store.requestableInvoices().map((r) => [r.id, r]),
    );
    const canViewOffer = this.store.canViewFinancingOffer();
    return this.store.filteredInvoices().map((invoice) => ({
      invoice,
      requestable: requestables.get(invoice.id) ?? null,
      offer: canViewOffer ? invoice.financingOffer ?? null : null,
    }));
  });

  ngOnInit(): void {
    this.store.loadInvoices();
  }

  protected onSearchChange(value: string): void {
    this.store.setFilter({ search: value });
  }

  protected onStatusChange(status: InvoiceStatus | null): void {
    this.store.setFilter({ status });
  }

  protected requestFinancing(invoice: RequestableInvoiceUi): void {
    this.store.requestFinancing(invoice);
  }
}
