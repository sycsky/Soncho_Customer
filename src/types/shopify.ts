export interface ShopifyCustomerAddress {
  address1?: string;
  address2?: string;
  city?: string;
  province?: string;
  country?: string;
  zip?: string;
}

export interface ShopifyCustomer {
  id?: string | number;
  email?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  phone?: string;
  tags?: string | string[];
  acceptsMarketing?: boolean;
  ordersCount?: number;
  totalSpent?: string | number;
  defaultAddress?: ShopifyCustomerAddress;
}

