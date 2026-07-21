import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { InvoiceStatus } from '@org/invoicing/domain';

@Component({
  selector: 'lib-invoice-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge" [attr.data-status]="status()">{{ label() }}</span>`,
  styles: [
    `
      .badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 600;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        background: #e2e8f0;
        color: #475569;
      }
      .badge[data-status='APPROVED'] { background: #d1fae5; color: #065f46; }
      .badge[data-status='FINANCING_REQUESTED'] { background: #dbeafe; color: #1e40af; }
      .badge[data-status='FINANCED'] { background: #ede9fe; color: #5b21b6; }
      .badge[data-status='PAID'] { background: #d1fae5; color: #064e3b; }
      .badge[data-status='REJECTED'] { background: #fee2e2; color: #991b1b; }
    `,
  ],
})
export class InvoiceStatusBadgeComponent {
  readonly status = input.required<InvoiceStatus>();

  readonly label = computed(() => this.status().replace(/_/g, ' '));
}
