import { ApolloLink, FetchResult, Observable } from '@apollo/client/core';
import { FinancingErrorCode, InvoiceStatus } from '@org/invoicing/domain';
import { InvoiceDto } from '../models/invoice.dto';

const MOCK_INVOICES: InvoiceDto[] = [
  {
    id: 'inv-001',
    invoiceNumber: 'INV-2026-001',
    supplierName: 'Acme Corp',
    buyerName: 'GlobalBuyer Ltd',
    amount: 150000,
    currency: 'USD',
    dueDate: '2026-04-01',
    status: InvoiceStatus.APPROVED,
    financingOffer: { discountRate: 0.02, netAmount: 147000, expiresAt: '2026-03-15' },
  },
  {
    id: 'inv-002',
    invoiceNumber: 'INV-2026-002',
    supplierName: 'Acme Corp',
    buyerName: 'TechMart Inc',
    amount: 75000,
    currency: 'USD',
    dueDate: '2026-05-15',
    status: InvoiceStatus.DRAFT,
  },
  {
    id: 'inv-003',
    invoiceNumber: 'INV-2026-003',
    supplierName: 'Acme Corp',
    buyerName: 'RetailCo',
    amount: 230000,
    currency: 'EUR',
    dueDate: '2026-03-30',
    status: InvoiceStatus.FINANCED,
  },
  {
    id: 'inv-004',
    invoiceNumber: 'INV-2026-004',
    supplierName: 'Northwind Traders',
    buyerName: 'Fabrikam SA',
    amount: 92000,
    currency: 'EUR',
    dueDate: '2026-06-10',
    status: InvoiceStatus.DRAFT,
  },
  {
    id: 'inv-005',
    invoiceNumber: 'INV-2026-005',
    supplierName: 'Contoso Ltd',
    buyerName: 'Adventure Works',
    amount: 310000,
    currency: 'USD',
    dueDate: '2026-04-20',
    status: InvoiceStatus.APPROVED,
    financingOffer: { discountRate: 0.025, netAmount: 302250, expiresAt: '2026-04-05' },
  },
  {
    id: 'inv-006',
    invoiceNumber: 'INV-2026-006',
    supplierName: 'Blue Yonder',
    buyerName: 'GlobalBuyer Ltd',
    amount: 58000,
    currency: 'GBP',
    dueDate: '2026-05-02',
    status: InvoiceStatus.FINANCING_REQUESTED,
    financingOffer: { discountRate: 0.018, netAmount: 56956, expiresAt: '2026-04-18' },
  },
  {
    id: 'inv-007',
    invoiceNumber: 'INV-2026-007',
    supplierName: 'Wingtip Toys',
    buyerName: 'TechMart Inc',
    amount: 124500,
    currency: 'USD',
    dueDate: '2026-05-25',
    status: InvoiceStatus.FINANCING_REQUESTED,
    financingOffer: { discountRate: 0.022, netAmount: 121761, expiresAt: '2026-05-10' },
  },
  {
    id: 'inv-008',
    invoiceNumber: 'INV-2026-008',
    supplierName: 'Northwind Traders',
    buyerName: 'RetailCo',
    amount: 187500,
    currency: 'USD',
    dueDate: '2026-03-15',
    status: InvoiceStatus.FINANCED,
  },
  {
    id: 'inv-009',
    invoiceNumber: 'INV-2026-009',
    supplierName: 'Contoso Ltd',
    buyerName: 'Fabrikam SA',
    amount: 44000,
    currency: 'EUR',
    dueDate: '2026-02-28',
    status: InvoiceStatus.PAID,
  },
  {
    id: 'inv-010',
    invoiceNumber: 'INV-2026-010',
    supplierName: 'Acme Corp',
    buyerName: 'Adventure Works',
    amount: 265000,
    currency: 'USD',
    dueDate: '2026-01-31',
    status: InvoiceStatus.PAID,
  },
  {
    id: 'inv-011',
    invoiceNumber: 'INV-2026-011',
    supplierName: 'Blue Yonder',
    buyerName: 'TechMart Inc',
    amount: 89000,
    currency: 'GBP',
    dueDate: '2026-04-08',
    status: InvoiceStatus.REJECTED,
  },
  {
    id: 'inv-012',
    invoiceNumber: 'INV-2026-012',
    supplierName: 'Wingtip Toys',
    buyerName: 'GlobalBuyer Ltd',
    amount: 30500,
    currency: 'USD',
    dueDate: '2026-03-22',
    status: InvoiceStatus.REJECTED,
  },
];

let invoices = [...MOCK_INVOICES];

export function createMockApolloLink(): ApolloLink {
  return new ApolloLink((operation) => {
    return new Observable<FetchResult>((observer) => {
      const { operationName, variables } = operation;

      switch (operationName) {
        case 'GetInvoices': {
          const filter = variables?.['filter'];
          let result = [...invoices];
          if (filter?.status) result = result.filter((i) => i.status === filter.status);
          if (filter?.search) {
            const q = filter.search.toLowerCase();
            result = result.filter(
              (i) =>
                i.invoiceNumber.toLowerCase().includes(q) ||
                i.buyerName.toLowerCase().includes(q),
            );
          }
          observer.next({ data: { invoices: result } });
          break;
        }

        case 'GetInvoice': {
          const id = variables?.['id'];
          observer.next({ data: { invoice: invoices.find((i) => i.id === id) ?? null } });
          break;
        }

        case 'RequestFinancing': {
          const invoiceId = variables?.['invoiceId'];
          const invoice = invoices.find((i) => i.id === invoiceId);

          if (!invoice || invoice.status !== InvoiceStatus.APPROVED) {
            observer.next({
              data: {
                requestFinancing: {
                  __typename: 'FinancingError',
                  code: FinancingErrorCode.INVOICE_NOT_APPROVED,
                  message: 'Invoice must be in APPROVED status.',
                },
              },
            });
            break;
          }

          const updated: InvoiceDto = {
            ...invoice,
            status: InvoiceStatus.FINANCING_REQUESTED,
          };
          invoices = invoices.map((i) => (i.id === invoiceId ? updated : i));
          observer.next({
            data: {
              requestFinancing: {
                __typename: 'FinancingRequested',
                invoice: updated,
              },
            },
          });
          break;
        }

        default:
          observer.next({ data: null, errors: [{ message: `Unknown operation: ${operationName}` }] });
      }

      observer.complete();
    });
  });
}
