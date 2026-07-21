import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { DecimalPipe, PercentPipe } from '@angular/common';
import { InvoiceRowUi, RequestableInvoiceUi } from '@org/invoicing/domain';
import { InvoiceStatusBadgeComponent } from '../invoice-status-badge.component';

@Component({
  selector: 'lib-invoice-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, PercentPipe, InvoiceStatusBadgeComponent],
  template: `
    <ul class="invoice-list">
      @for (row of rows(); track row.invoice.id) {
        <li class="invoice-list__item">
          <div class="invoice-list__row">
            <span class="invoice-list__number">{{ row.invoice.invoiceNumber }}</span>
            <lib-invoice-status-badge [status]="row.invoice.status" />
          </div>

          <div class="invoice-list__row invoice-list__row--muted">
            <span>{{ row.invoice.supplierName }} → {{ row.invoice.buyerName }}</span>
            <span>Due {{ row.invoice.dueDate }}</span>
          </div>

          <div class="invoice-list__row">
            <span class="invoice-list__amount">
              {{ row.invoice.amount / 100 | number: '1.2-2' }} {{ row.invoice.currency }}
            </span>
            @if (row.requestable; as requestable) {
              <button (click)="requestFinancing.emit(requestable)">Request Financing</button>
            }
          </div>

          @if (row.offer; as offer) {
            <div class="invoice-list__offer">
              <span>{{ offer.discountRate | percent: '1.2-2' }} discount</span>
              <span>
                Net {{ offer.netAmount / 100 | number: '1.2-2' }} {{ row.invoice.currency }}
              </span>
              <span>Expires {{ offer.expiresAt }}</span>
            </div>
          }
        </li>
      } @empty {
        <li class="invoice-list__empty">No invoices found.</li>
      }
    </ul>
  `,
  styles: `
    .invoice-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .invoice-list__item {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 1rem;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #fff;
    }
    .invoice-list__row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }
    .invoice-list__row--muted {
      color: #64748b;
      font-size: 0.875rem;
    }
    .invoice-list__number {
      font-weight: 600;
    }
    .invoice-list__amount {
      font-variant-numeric: tabular-nums;
      font-weight: 600;
    }
    .invoice-list__empty {
      padding: 1rem;
      text-align: center;
      color: #64748b;
    }
    .invoice-list__offer {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      padding: 0.5rem 0.75rem;
      background: #eef2ff;
      color: #3730a3;
      border-radius: 6px;
      font-size: 0.8125rem;
    }
  `,
})
export class InvoiceListComponent {
  readonly rows = input.required<InvoiceRowUi[]>();

  readonly requestFinancing = output<RequestableInvoiceUi>();
}
