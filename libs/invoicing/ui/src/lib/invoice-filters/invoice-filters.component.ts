import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InvoiceStatus } from '@org/invoicing/domain';

@Component({
  selector: 'lib-invoice-filters',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <div class="filters">
      <input
        type="text"
        placeholder="Search by invoice number or buyer..."
        [ngModel]="search()"
        (ngModelChange)="searchChange.emit($event)"
        class="search-input"
      />

      <select (change)="onStatusChange($event)">
        <option value="">All statuses</option>
        @for (option of statusOptions; track option) {
          <option [value]="option" [selected]="option === status()">{{ option }}</option>
        }
      </select>
    </div>
  `,
  styles: `
    .filters {
      display: flex;
      gap: 1rem;
    }
    .search-input {
      width: 300px;
    }
    `
})
export class InvoiceFiltersComponent {
  readonly search = input<string>('');
  readonly status = input<InvoiceStatus | null>(null);

  readonly searchChange = output<string>();
  readonly statusChange = output<InvoiceStatus | null>();

  protected readonly statusOptions: InvoiceStatus[] = [
    InvoiceStatus.DRAFT,
    InvoiceStatus.APPROVED,
    InvoiceStatus.FINANCING_REQUESTED,
    InvoiceStatus.FINANCED,
    InvoiceStatus.PAID,
    InvoiceStatus.REJECTED,
  ];

  protected onStatusChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.statusChange.emit(value ? (value as InvoiceStatus) : null);
  }
}
