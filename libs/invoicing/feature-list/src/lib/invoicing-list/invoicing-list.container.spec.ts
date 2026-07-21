import { TestBed } from '@angular/core/testing';
import { AuthStore } from '@org/auth/data-access';
import { InvoiceService, InvoicingStore } from '@org/invoicing/data-access';
import {
  InvoiceRowUi,
  InvoiceStatus,
} from '@org/invoicing/domain';
import { of } from 'rxjs';
import { InvoicingListContainer } from './invoicing-list.container';

const approvedDto = {
  id: '2',
  invoiceNumber: 'INV-2',
  supplierName: 'Supplier',
  buyerName: 'ACME',
  amount: 200,
  currency: 'USD',
  dueDate: '2026-02-01',
  status: InvoiceStatus.APPROVED,
  financingOffer: {
    discountRate: 0.02,
    netAmount: 196,
    expiresAt: '2026-03-01',
  },
} as const;

const draftDto = {
  id: '1',
  invoiceNumber: 'INV-1',
  supplierName: 'Supplier',
  buyerName: 'Other Buyer',
  amount: 100,
  currency: 'USD',
  dueDate: '2026-01-01',
  status: InvoiceStatus.DRAFT,
} as const;

describe('InvoicingListContainer.rows', () => {
  let container: InvoicingListContainer;
  let store: InstanceType<typeof InvoicingStore>;
  let auth: InstanceType<typeof AuthStore>;
  let service: {
    getInvoices: ReturnType<typeof vi.fn>;
    requestFinancing: ReturnType<typeof vi.fn>;
  };

  const rowsOf = (c: InvoicingListContainer): InvoiceRowUi[] =>
    (c as unknown as { rows: () => InvoiceRowUi[] }).rows();

  beforeEach(() => {
    service = {
      getInvoices: vi.fn().mockReturnValue(of([])),
      requestFinancing: vi.fn().mockReturnValue(of(null)),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: InvoiceService, useValue: service }],
    });
    store = TestBed.inject(InvoicingStore);
    auth = TestBed.inject(AuthStore);
    container = TestBed.runInInjectionContext(
      () => new InvoicingListContainer(),
    );
  });

  it('returns an empty list when the store has no invoices', () => {
    expect(rowsOf(container)).toEqual([]);
  });

  it('pairs each filtered invoice with null requestable and null offer when the user lacks financing permission', () => {
    service.getInvoices.mockReturnValue(of([approvedDto, draftDto]));
    store.loadInvoices();

    const rows = rowsOf(container);
    expect(rows.map((r) => r.invoice.id)).toEqual(['2', '1']);
    for (const row of rows) {
      expect(row.requestable).toBeNull();
      expect(row.offer).toBeNull();
    }
  });

  it('attaches a requestable and financing offer to approved invoices when the user has permission', () => {
    service.getInvoices.mockReturnValue(of([approvedDto, draftDto]));
    store.loadInvoices();
    auth.setRole('supplier-financing');

    const rows = rowsOf(container);
    const approvedRow = rows.find((r) => r.invoice.id === '2');
    const draftRow = rows.find((r) => r.invoice.id === '1');

    expect(approvedRow).toBeDefined();
    expect(approvedRow?.requestable?.id).toBe('2');
    expect(approvedRow?.offer).toEqual({
      discountRate: 0.02,
      netAmount: 196,
      expiresAt: '2026-03-01',
    });

    expect(draftRow).toBeDefined();
    expect(draftRow?.requestable).toBeNull();
    expect(draftRow?.offer).toBeNull();
  });

  it('reflects filter changes made through the store', () => {
    service.getInvoices.mockReturnValue(of([approvedDto, draftDto]));
    store.loadInvoices();
    store.setFilter({ status: InvoiceStatus.APPROVED });

    expect(rowsOf(container).map((r) => r.invoice.id)).toEqual(['2']);
  });

  it('hides the offer even for APPROVED invoices when the user lacks permission', () => {
    service.getInvoices.mockReturnValue(of([approvedDto]));
    store.loadInvoices();

    const [row] = rowsOf(container);
    expect(row.invoice.id).toBe('2');
    expect(row.offer).toBeNull();
    expect(row.requestable).toBeNull();
  });
});
