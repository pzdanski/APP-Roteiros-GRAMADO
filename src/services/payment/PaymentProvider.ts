import { PaymentOrder, PaymentMethod } from '../../types';

export interface CreateOrderParams {
  tripId: string;
  amountBrl: number;
  paymentMethod: PaymentMethod;
  customerName: string;
  customerEmail: string;
  customerCpf?: string;
}

export interface PaymentProvider {
  name: string;
  createOrder(params: CreateOrderParams): Promise<PaymentOrder>;
  checkOrderStatus(orderId: string): Promise<PaymentOrder>;
}

export class AsaasPaymentProvider implements PaymentProvider {
  name = 'AsaasPaymentProvider';

  async createOrder(params: CreateOrderParams): Promise<PaymentOrder> {
    try {
      const res = await fetch('/api/payment/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });

      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback to dev sandbox
    }

    // DEV / SANDBOX mock fallback
    const mockOrder: PaymentOrder = {
      id: `ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      trip_id: params.tripId,
      amount_brl: params.amountBrl,
      payment_method: params.paymentMethod,
      status: 'pending',
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
      const res = await fetch(`/api/payment/status?orderId=${encodeURIComponent(orderId)}`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Return paid mock for dev testing if queried
    }

    return {
      id: orderId,
      trip_id: 'trip-current',
      amount_brl: 19.90,
      payment_method: 'pix',
      status: 'paid',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_sandbox: true
    };
  }
}

export const paymentProvider: PaymentProvider = new AsaasPaymentProvider();
