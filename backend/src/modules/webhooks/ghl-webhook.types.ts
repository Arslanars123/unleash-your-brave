export interface GhlPurchaseWebhookPayload {
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  contactId?: string;
  product?: string;
  amount?: string | number;
}

export interface GhlPurchaseResult {
  received: true;
  created: boolean;
  contactId: string | null;
  product: string | null;
  amount: number | null;
  user: {
    id: string;
    email: string;
    name: string;
    firstName: string;
    lastName: string;
    role: string;
    status: string;
  };
}
