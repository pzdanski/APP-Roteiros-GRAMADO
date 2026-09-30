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
    const res = await fetch('/api/payments/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });

    if (res.ok) {
      return await res.json();
    }

    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || errData.message || 'Falha ao processar cobrança via Asaas.');
  }

  async checkOrderStatus(orderId: string): Promise<PaymentOrder> {
    const res = await fetch(`/api/payments/status?orderId=${encodeURIComponent(orderId)}`);
    if (res.ok) {
      return await res.json();
    }
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Erro ao consultar status do pagamento.');
  }

  async simulateWebhookApproval(orderId: string): Promise<PaymentOrder> {
    const res = await fetch('/api/payments/simulate-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId })
    });

    if (res.ok) {
      return await res.json();
    }

    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Simulação de webhook indisponível.');
  }
}

export const paymentProvider: PaymentProvider = new AsaasPaymentProvider();
