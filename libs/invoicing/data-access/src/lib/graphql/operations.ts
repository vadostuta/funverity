import { gql } from '@apollo/client/core';

// Treat as codegen output — do not hand-edit field lists here

export const GET_INVOICES = gql`
  query GetInvoices($filter: InvoiceFilter) {
    invoices(filter: $filter) {
      id
      invoiceNumber
      supplierName
      buyerName
      amount
      currency
      dueDate
      status
      financingOffer {
        discountRate
        netAmount
        expiresAt
      }
    }
  }
`;

export const GET_INVOICE = gql`
  query GetInvoice($id: ID!) {
    invoice(id: $id) {
      id
      invoiceNumber
      supplierName
      buyerName
      amount
      currency
      dueDate
      status
      financingOffer {
        discountRate
        netAmount
        expiresAt
      }
    }
  }
`;

export const REQUEST_FINANCING = gql`
  mutation RequestFinancing($invoiceId: ID!) {
    requestFinancing(invoiceId: $invoiceId) {
      ... on FinancingRequested {
        invoice {
          id
          status
          financingOffer {
            discountRate
            netAmount
            expiresAt
          }
        }
      }
      ... on FinancingError {
        code
        message
      }
    }
  }
`;
