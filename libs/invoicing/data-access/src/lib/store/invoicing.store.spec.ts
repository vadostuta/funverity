import { TestBed } from '@angular/core/testing';
import { AuthStore } from '@org/auth/data-access';
import {
  FinancingErrorCode,
  InvoiceStatus,
  RequestableInvoiceUi,
} from '@org/invoicing/domain';
import { Subject, of, throwError } from 'rxjs';
import type {
  FinancingErrorDto,
  FinancingRequestedDto,
  InvoiceDto,
} from '../models/invoice.dto';
import { InvoiceService } from '../services/invoice.service';
import { InvoicingStore } from './invoicing.store';

const approvedDto: InvoiceDto = {
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
};

const draftDto: InvoiceDto = {
  id: '1',
  invoiceNumber: 'INV-1',
  supplierName: 'Supplier',
  buyerName: 'Other Buyer',
  amount: 100,
  currency: 'USD',
  dueDate: '2026-01-01',
  status: InvoiceStatus.DRAFT,
};

describe('InvoicingStore', () => {
  let store: InstanceType<typeof InvoicingStore>;
  let auth: InstanceType<typeof AuthStore>;
  let service: {
    getInvoices: ReturnType<typeof vi.fn>;
    requestFinancing: ReturnType<typeof vi.fn>;
  };

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
  });

  describe('initial state', () => {
    it('exposes empty invoices, empty filter, idle status, and not loading', () => {
      expect(store.invoices()).toEqual([]);
      expect(store.filter()).toEqual({ status: null, search: '' });
      expect(store.requestStatus()).toBe('idle');
      expect(store.requestError()).toBeNull();
      expect(store.loading()).toBe(false);
    });
  });

  describe('loadInvoices', () => {
    it('maps DTOs into UI invoices on success and clears loading', () => {
      service.getInvoices.mockReturnValue(of([approvedDto, draftDto]));

      store.loadInvoices();

      expect(store.loading()).toBe(false);
      expect(store.invoices().map((i) => i.id)).toEqual(['2', '1']);
    });

    it('sets loading true while the request is in-flight and false after it resolves', () => {
      const source = new Subject<InvoiceDto[]>();
      service.getInvoices.mockReturnValue(source.asObservable());

      store.loadInvoices();
      expect(store.loading()).toBe(true);

      source.next([approvedDto]);
      source.complete();
      expect(store.loading()).toBe(false);
      expect(store.invoices()).toHaveLength(1);
    });

    it('clears loading and swallows the error stream on failure', () => {
      service.getInvoices.mockReturnValue(
        throwError(() => new Error('network')),
      );

      expect(() => store.loadInvoices()).not.toThrow();
      expect(store.loading()).toBe(false);
      expect(store.invoices()).toEqual([]);
    });
  });

  describe('setFilter', () => {
    it('merges partial patches into the existing filter', () => {
      store.setFilter({ search: 'acme' });
      expect(store.filter()).toEqual({ status: null, search: 'acme' });

      store.setFilter({ status: InvoiceStatus.APPROVED });
      expect(store.filter()).toEqual({
        status: InvoiceStatus.APPROVED,
        search: 'acme',
      });
    });
  });

  describe('filteredInvoices computed', () => {
    beforeEach(() => {
      service.getInvoices.mockReturnValue(of([approvedDto, draftDto]));
      store.loadInvoices();
    });

    it('returns every invoice when no filter is set', () => {
      expect(store.filteredInvoices().map((i) => i.id)).toEqual(['2', '1']);
    });

    it('filters by status', () => {
      store.setFilter({ status: InvoiceStatus.APPROVED });
      expect(store.filteredInvoices().map((i) => i.id)).toEqual(['2']);
    });

    it('filters by invoice number (case-insensitive)', () => {
      store.setFilter({ search: 'inv-1' });
      expect(store.filteredInvoices().map((i) => i.id)).toEqual(['1']);
    });

    it('filters by buyer name (case-insensitive)', () => {
      store.setFilter({ search: 'acme' });
      expect(store.filteredInvoices().map((i) => i.id)).toEqual(['2']);
    });
  });

  describe('requestableInvoices computed', () => {
    beforeEach(() => {
      service.getInvoices.mockReturnValue(of([approvedDto, draftDto]));
      store.loadInvoices();
    });

    it('returns [] when the current user lacks financing permission', () => {
      expect(store.requestableInvoices()).toEqual([]);
    });

    it('returns only APPROVED invoices for users with financing permission', () => {
      auth.setRole('supplier-financing');
      expect(store.requestableInvoices().map((i) => i.id)).toEqual(['2']);
    });
  });

  describe('canViewFinancingOffer computed', () => {
    it('reflects the financing permission on the current user', () => {
      expect(store.canViewFinancingOffer()).toBe(false);

      auth.setRole('supplier-financing');
      expect(store.canViewFinancingOffer()).toBe(true);
    });
  });

  describe('requestFinancing', () => {
    const seedApproved = () => {
      service.getInvoices.mockReturnValue(of([approvedDto]));
      store.loadInvoices();
      auth.setRole('supplier-financing');
    };

    const takeRequestable = (): RequestableInvoiceUi => {
      const requestable = store.requestableInvoices()[0];
      if (!requestable) throw new Error('expected a requestable invoice');
      return requestable;
    };

    it('optimistically flips status to FINANCING_REQUESTED while the request is in-flight', () => {
      seedApproved();
      const requestable = takeRequestable();
      service.requestFinancing.mockReturnValue(
        new Subject<FinancingRequestedDto | FinancingErrorDto>().asObservable(),
      );

      store.requestFinancing(requestable);

      expect(store.requestStatus()).toBe('pending');
      expect(store.invoices()[0].status).toBe(InvoiceStatus.FINANCING_REQUESTED);
    });

    it('marks success and swaps in the updated invoice on FinancingRequested', () => {
      seedApproved();
      const requestable = takeRequestable();
      const financedDto: InvoiceDto = {
        ...approvedDto,
        status: InvoiceStatus.FINANCED,
      };
      service.requestFinancing.mockReturnValue(
        of<FinancingRequestedDto>({
          __typename: 'FinancingRequested',
          invoice: financedDto,
        }),
      );

      store.requestFinancing(requestable);

      expect(store.requestStatus()).toBe('success');
      expect(store.invoices()[0].status).toBe(InvoiceStatus.FINANCED);
    });

    it('rolls back the invoice and reports the server message on FinancingError', () => {
      seedApproved();
      const requestable = takeRequestable();
      service.requestFinancing.mockReturnValue(
        of<FinancingErrorDto>({
          __typename: 'FinancingError',
          code: FinancingErrorCode.OFFER_EXPIRED,
          message: 'expired',
        }),
      );

      store.requestFinancing(requestable);

      expect(store.requestStatus()).toBe('error');
      expect(store.requestError()).toBe('expired');
      expect(store.invoices()[0].status).toBe(InvoiceStatus.APPROVED);
    });

    it('rolls back the invoice and reports a generic message on network failure', () => {
      seedApproved();
      const requestable = takeRequestable();
      service.requestFinancing.mockReturnValue(
        throwError(() => new Error('network')),
      );

      store.requestFinancing(requestable);

      expect(store.requestStatus()).toBe('error');
      expect(store.requestError()).toBe('Network error. Please try again.');
      expect(store.invoices()[0].status).toBe(InvoiceStatus.APPROVED);
    });
  });

});
