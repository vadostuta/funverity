import { InvoiceFilterUi, InvoiceUi } from '@org/invoicing/domain';

export type RequestStatus = 'idle' | 'pending' | 'success' | 'error';

export interface InvoicingState {
  invoices: InvoiceUi[];
  filter: InvoiceFilterUi;
  requestStatus: RequestStatus;
  requestError: string | null;
  loading: boolean;
}

export const initialState: InvoicingState = {
  invoices: [],
  filter: { status: null, search: '' },
  requestStatus: 'idle',
  requestError: null,
  loading: false,
};
