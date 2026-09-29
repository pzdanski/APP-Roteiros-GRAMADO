import { PaymentOrder } from '../../types';

export interface PaymentRepository {
  name: string;
  isRealDatabase: boolean;
  saveOrder(order: PaymentOrder): Promise<PaymentOrder>;
  getOrderById(id: string): Promise<PaymentOrder | null>;
  getOrderByTripId(tripId: string): Promise<PaymentOrder | null>;
  updateOrderStatus(orderId: string, status: 'pending' | 'processing' | 'paid' | 'failed' | 'refunded'): Promise<PaymentOrder>;
}

export class InMemoryPaymentRepository implements PaymentRepository {
  name = 'InMemoryPaymentRepository (Mock)';
  isRealDatabase = false;
  private orders = new Map<string, PaymentOrder>();

  async saveOrder(order: PaymentOrder): Promise<PaymentOrder> {
    this.orders.set(order.id, { ...order });
    return order;
  }

  async getOrderById(id: string): Promise<PaymentOrder | null> {
    return this.orders.get(id) || null;
  }

  async getOrderByTripId(tripId: string): Promise<PaymentOrder | null> {
    for (const order of this.orders.values()) {
      if (order.trip_id === tripId) return order;
    }
    return null;
  }

  async updateOrderStatus(orderId: string, status: 'pending' | 'processing' | 'paid' | 'failed' | 'refunded'): Promise<PaymentOrder> {
    const existing = this.orders.get(orderId);
    if (!existing) {
      throw new Error(`Order ${orderId} not found`);
    }
    existing.status = status;
    if (status === 'paid') {
      existing.paid_at = new Date().toISOString();
    }
    this.orders.set(orderId, existing);
    return existing;
  }
}

export class SupabasePaymentRepository implements PaymentRepository {
  name = 'SupabasePaymentRepository';
  isRealDatabase = true;

  async saveOrder(order: PaymentOrder): Promise<PaymentOrder> {
    const res = await fetch('/api/db/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order)
    });
    if (!res.ok) {
      throw new Error(`DATABASE_UNAVAILABLE: Failed to save payment order in Supabase`);
    }
    return await res.json();
  }

  async getOrderById(id: string): Promise<PaymentOrder | null> {
    const res = await fetch(`/api/db/payments/${encodeURIComponent(id)}`);
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`DATABASE_UNAVAILABLE: Failed to get payment order ${id}`);
    }
    return await res.json();
  }

  async getOrderByTripId(tripId: string): Promise<PaymentOrder | null> {
    const res = await fetch(`/api/db/payments/trip/${encodeURIComponent(tripId)}`);
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`DATABASE_UNAVAILABLE: Failed to get payment for trip ${tripId}`);
    }
    return await res.json();
  }

  async updateOrderStatus(orderId: string, status: 'pending' | 'processing' | 'paid' | 'failed' | 'refunded'): Promise<PaymentOrder> {
    const res = await fetch(`/api/db/payments/${encodeURIComponent(orderId)}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (!res.ok) {
      throw new Error(`DATABASE_UNAVAILABLE: Failed to update payment status for ${orderId}`);
    }
    return await res.json();
  }
}
