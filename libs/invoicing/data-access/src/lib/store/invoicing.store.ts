import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { AuthStore } from '@org/auth/data-access';
import {
  EligibleInvoiceUi,
  InvoiceFilterUi,
  InvoiceStatus,
  InvoiceUi,
  RequestableInvoiceUi,
  toRequestable,
} from '@org/invoicing/domain';
import { EMPTY, pipe } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
import { InvoiceMapper } from '../mappers/invoice.mapper';
import { InvoiceService } from '../services/invoice.service';
import { initialState, InvoicingState, RequestStatus } from './invoicing.state';

export const InvoicingStore = signalStore(
  { providedIn: 'root' },
  withState<InvoicingState>(initialState),
  withComputed((store) => {
    const auth = inject(AuthStore);

    const filteredInvoices = computed(() => {
      const { status, search } = store.filter();
      return store.invoices().filter((inv) => {
        if (status !== null && inv.status !== status) return false;
        if (search) {
          const q = search.toLowerCase();
          return (
            inv.invoiceNumber.toLowerCase().includes(q) ||
            inv.buyerName.toLowerCase().includes(q)
          );
        }
        return true;
      });
    });

    const requestableInvoices = computed<RequestableInvoiceUi[]>(() => {
      if (!auth.hasFinancingPermission()) return [];
      return store
        .invoices()
        .map(toRequestable)
        .filter((i): i is RequestableInvoiceUi => i !== null);
    });

    // Viewing the offer is gated by the same permission as requesting it.
    // Surfacing it through the store keeps the container ignorant of AuthStore.
    const canViewFinancingOffer = computed(() => auth.hasFinancingPermission());

    return { filteredInvoices, requestableInvoices, canViewFinancingOffer };
  }),
  withMethods((store, service = inject(InvoiceService)) => ({
    loadInvoices: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { loading: true })),
        switchMap(() =>
          service.getInvoices().pipe(
            tap((dtos) =>
              patchState(store, {
                invoices: InvoiceMapper.toInvoicesUi(dtos),
                loading: false,
              }),
            ),
            catchError(() => {
              patchState(store, { loading: false });
              return EMPTY;
            }),
          ),
        ),
      ),
    ),

    setFilter(patch: Partial<InvoiceFilterUi>): void {
      patchState(store, (state) => ({ filter: { ...state.filter, ...patch } }));
    },

    // Only a RequestableInvoiceUi can reach this signature — the branded type
    // is the compile-time proof that the invoice is APPROVED *and* the caller
    // obtained it via the store's `requestableInvoices` (permission-gated).
    requestFinancing: rxMethod<RequestableInvoiceUi>(
      pipe(
        switchMap((invoice) => {
          const original: InvoiceUi = invoice;
          const invoiceId = invoice.id;

          const optimisticUpdate = (i: InvoiceUi): InvoiceUi =>
            i.id === invoiceId
              ? ({ ...i, status: InvoiceStatus.FINANCING_REQUESTED } as EligibleInvoiceUi)
              : i;

          patchState(store, (state) => ({
            requestStatus: 'pending' as RequestStatus,
            invoices: state.invoices.map(optimisticUpdate),
          }));

          return service.requestFinancing(invoiceId).pipe(
            tap((dto) => {
              const result = InvoiceMapper.toRequestFinancingResultUi(dto);
              if (result.__typename === 'FinancingRequested') {
                patchState(store, (state) => ({
                  requestStatus: 'success' as RequestStatus,
                  invoices: state.invoices.map((i) =>
                    i.id === invoiceId ? result.invoice : i,
                  ),
                }));
              } else {
                patchState(store, (state) => ({
                  requestStatus: 'error' as RequestStatus,
                  requestError: result.message,
                  invoices: state.invoices.map((i) => (i.id === invoiceId ? original : i)),
                }));
              }
            }),
            catchError(() => {
              patchState(store, (state) => ({
                requestStatus: 'error' as RequestStatus,
                requestError: 'Network error. Please try again.',
                invoices: state.invoices.map((i) => (i.id === invoiceId ? original : i)),
              }));
              return EMPTY;
            }),
          );
        }),
      ),
    )
  })),
);
