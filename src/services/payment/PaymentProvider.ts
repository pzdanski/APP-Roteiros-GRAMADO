import { PaymentOrder, PaymentMethod } from '../../types';
import { PriceService } from './PriceService';

export interface CreateOrderParams {
  tripId: string;
  amountBrl?: number; // Optional on frontend, authoritative on backend
  paymentMethod: PaymentMethod;
  customerName: string;
  customerEmail: string;
  customerCpf?: string;
  startDate?: string;
  endDate?: string;
  numberOfDays?: number;
  preferences?: any;
}

export interface PaymentProvider {
  name: string;
  createOrder(params: CreateOrderParams): Promise<PaymentOrder>;
  checkOrderStatus(orderId: string): Promise<PaymentOrder>;
  simulateWebhookApproval(orderId: string): Promise<PaymentOrder>;
  calculatePrice(days: number): number;
}

export class AsaasPaymentProvider implements PaymentProvider {
  name = 'AsaasPaymentProvider';

  calculatePrice(days: number): number {
    return PriceService.calculatePrice(days);
  }

  async createOrder(params: CreateOrderParams): Promise<PaymentOrder> {
    try {
      // Primary route: /api/payments/checkout
      const res = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });

      if (res.ok) {
        return await res.json();
      }

      // Fallback route: /api/payment/checkout
      const fallbackRes = await fetch('/api/payment/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });

      if (fallbackRes.ok) {
        return await fallbackRes.json();
      }
    } catch (err) {
      console.warn('[PaymentProvider] Checkout fetch error, using local fallback:', err);
    }

    // Client-side fallback if server is unreachable
    const calculatedPrice = params.amountBrl || PriceService.calculatePrice(params.numberOfDays || 4);
    const mockOrder: PaymentOrder = {
      id: `ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      trip_id: params.tripId,
      amount_brl: calculatedPrice,
      payment_method: params.paymentMethod,
      status: 'PENDING',
      customer_name: params.customerName,
      customer_email: params.customerEmail,
      pix_qr_code: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=00020126580014BR.GOV.BCB.PIX0136duo21-serra-gaucha-roteiro-licenca5204000053039865802BR5913DUO21%20TURISMO6007GRAMADO62070503***6304ABCD',
      pix_copy_paste: '00020126580014BR.GOV.BCB.PIX0136duo21-serra-gaucha-roteiro-licenca5204000053039865802BR5913DUO21 TURISMO6007GRAMADO62070503***6304ABCD',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_sandbox: true
    };

    return mockOrder;
  }

  async checkOrderStatus(orderId: string): Promise<PaymentOrder> {
    try {
      const res = await fetch(`/api/payments/status?orderId=${encodeURIComponent(orderId)}`);
      if (res.ok) {
        return await res.json();
      }
      const fallbackRes = await fetch(`/api/payment/status?orderId=${encodeURIComponent(orderId)}`);
      if (fallbackRes.ok) {
        return await fallbackRes.json();
      }
    } catch {
      // ignore
    }

    return {
      id: orderId,
      trip_id: 'trip-current',
      amount_brl: 19.90,
      payment_method: 'pix',
      status: 'PENDING',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_sandbox: true
    };
  }

  async simulateWebhookApproval(orderId: string): Promise<PaymentOrder> {
    try {
      const res = await fetch('/api/payments/simulate-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId })
      });

      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('[PaymentProvider] Simulation error:', err);
    }

    return {
      id: orderId,
      trip_id: 'trip-current',
      amount_brl: 19.90,
      payment_method: 'pix',
      status: 'PAID',
      paid_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_sandbox: true
    };
  }
}

export const paymentProvider: PaymentProvider = new AsaasPaymentProvider();
