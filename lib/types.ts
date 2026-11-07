// Shapes returned by the HSSB mock sales-orders API (only the fields this app reads are required).

export type SalesStatus = "Open order" | "Invoiced" | "Delivered" | "Cancelled" | (string & {});

export interface SalesOrder {
  SalesId: string;
  SalesName: string;
  CustAccount: string;
  InventSiteId: string;
  SalesStatus: SalesStatus;
  CreatedDateTime1: string;
  HAR_TotalSOAmount: number;
  HAR_InvoicedAmount?: number;
  HAR_BalanceAmount?: number;
  DocumentStatus?: string;
  ShippingDateRequested?: string;
  SalesTaker?: string;
  CustomerRef?: string;
  SalesType?: string;
  SalesGroup?: string;
  SalesDistrictDescription?: string;
  HAR_DeliveryDistrictDescription?: string;
  DOT_ItemGroupId?: string;
  DOT_SONotes?: string | null;
}

export interface OrdersSummary {
  total_orders: number;
  filtered_orders: number;
  open_orders: number;
  invoiced_orders: number;
  delivered_orders: number;
  cancelled_orders: number;
  total_order_value: number;
}

export interface OrdersListResponse {
  summary: OrdersSummary;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  sort: string;
  order: "asc" | "desc";
  data: SalesOrder[];
}

export interface Facet {
  value: string;
  count: number;
}

export interface MetaResponse {
  facets: { statuses: Facet[]; sites: Facet[] };
}

export interface ApiError {
  error: string;
}
