import { PaymentOrder } from '../../types';

export interface PaymentRepository {
  name: string;
  isRealDatabase: boolean;
  saveOrder(order: PaymentOrder): Promise<PaymentOrder>;
  getOrderById(id: string): Promise<PaymentOrder | null>;
  getOrderByTripId(tripId: string): Promise<PaymentOrder | null>;
}

export class InMemoryPaymentRepository implements PaymentRepository {
  name = 'InMemoryPaymentRepository';
  isRealDatabase = false;
  private orders = new Map<string, PaymentOrder>();

  async saveOrder(order: PaymentOrder): Promise<PaymentOrder> {
    this.orders.set(order.id, order);
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
}

export const paymentRepository: PaymentRepository = new InMemoryPaymentRepository();
