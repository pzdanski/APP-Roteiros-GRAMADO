import { NormalizedPaymentStatus, PaymentMethod, PaymentOrder } from '../../types';
import { externalFetch } from '../utils/externalFetch';

export interface CreateCustomerParams {
  name: string;
  email: string;
  cpfCnpj?: string;
  phone?: string;
}

export interface CreatePaymentParams {
  customerId: string;
  tripId: string;
  amountBrl: number;
  paymentMethod: PaymentMethod;
  description?: string;
  customerName?: string;
  customerEmail?: string;
  customerCpf?: string;
  idempotencyKey?: string;
}

export interface PixQrCodeResponse {
  encodedImage?: string;
  payload: string;
  expirationDate?: string;
}

export interface WebhookResult {
  valid: boolean;
  event: string;
  paymentId: string;
  tripId?: string;
  normalizedStatus: NormalizedPaymentStatus;
  isPaid: boolean;
  error?: string;
}

export class AsaasServerProvider {
  private apiKey: string;
  private environment: 'sandbox' | 'production';
  private webhookToken: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.ASAAS_API_KEY || '';
    this.environment = (process.env.ASAAS_ENV === 'production' ? 'production' : 'sandbox');
    this.webhookToken = process.env.ASAAS_WEBHOOK_TOKEN || '';
    this.baseUrl = this.environment === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://sandbox.asaas.com/api/v3';
  }

  private getApiKey(): string {
    return process.env.ASAAS_API_KEY || this.apiKey || '';
  }

  public getEnvironment(): 'sandbox' | 'production' {
    return (process.env.ASAAS_ENV === 'production' ? 'production' : this.environment);
  }

  public isSandbox(): boolean {
    return this.getEnvironment() === 'sandbox';
  }

  public isConfigured(): boolean {
    const key = this.getApiKey();
    return Boolean(key && key.trim().length > 0);
  }

  /**
   * Normalizes Asaas status into domain NormalizedPaymentStatus.
   */
  public normalizeStatus(asaasStatus?: string): NormalizedPaymentStatus {
    if (!asaasStatus) return 'PENDING';
    const s = asaasStatus.toUpperCase();
    switch (s) {
      case 'PENDING':
      case 'AWAITING_PAYMENT':
        return 'PENDING';
      case 'RECEIVED':
      case 'CONFIRMED':
      case 'RECEIVED_IN_CASH':
      case 'PAID':
        return 'PAID';
      case 'OVERDUE':
        return 'EXPIRED';
      case 'REFUNDED':
      case 'REFUND_REQUESTED':
      case 'CHARGEBACK_REQUESTED':
        return 'REFUNDED';
      case 'DELETED':
      case 'CANCELLED':
        return 'CANCELLED';
      default:
        return 'PENDING';
    }
  }

  /**
   * Creates or retrieves a customer in Asaas.
   */
  public async createCustomer(params: CreateCustomerParams): Promise<string> {
    const key = this.getApiKey();
    if (!key) {
      throw new Error('CONFIG_ERROR: ASAAS_API_KEY não configurada no servidor.');
    }

    const cleanCpf = params.cpfCnpj ? params.cpfCnpj.replace(/\D/g, '') : undefined;

    // 1. Check if customer already exists by email
    try {
      const searchRes = await externalFetch(`${this.baseUrl}/customers?email=${encodeURIComponent(params.email)}`, {
        headers: {
          'access_token': key,
          'Content-Type': 'application/json'
        },
        timeoutMs: 8000,
        isIdempotent: true
      });

      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.data && searchData.data.length > 0) {
          const existing = searchData.data[0];
          // If customer exists but has no CPF registered and CPF was supplied, update customer
          if (!existing.cpfCnpj && cleanCpf) {
            try {
              await externalFetch(`${this.baseUrl}/customers/${existing.id}`, {
                method: 'POST',
                headers: {
                  'access_token': key,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ cpfCnpj: cleanCpf }),
                timeoutMs: 8000
              });
            } catch (updateErr) {
              console.warn('[Asaas] Warning updating existing customer CPF:', updateErr);
            }
          }
          return existing.id;
        }
      }
    } catch (err) {
      console.warn('[Asaas] Error searching customer by email:', err);
    }

    // 2. Create customer in Asaas
    const createRes = await externalFetch(`${this.baseUrl}/customers`, {
      method: 'POST',
      headers: {
        'access_token': key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: params.name,
        email: params.email,
        cpfCnpj: cleanCpf || undefined,
        mobilePhone: params.phone || undefined
      }),
      timeoutMs: 8000,
      isIdempotent: false
    });

    if (!createRes.ok) {
      const errData = await createRes.json().catch(() => ({}));
      const desc = errData.errors?.[0]?.description || `Falha ao cadastrar cliente no Asaas (${createRes.status})`;
      console.error('[Asaas] Create customer error:', errData);
      throw new Error(desc);
    }

    const createdData = await createRes.json();
    return createdData.id;
  }

  /**
   * Creates a charge in Asaas (PIX or Credit Card).
   */
  public async createPayment(params: CreatePaymentParams): Promise<PaymentOrder> {
    const key = this.getApiKey();
    if (!key) {
      throw new Error('CONFIG_ERROR: ASAAS_API_KEY não configurada no servidor.');
    }

    const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    // Calculate due date (tomorrow)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);
    const dueDateStr = dueDate.toISOString().split('T')[0];

    const billingType = params.paymentMethod === 'credit_card' ? 'CREDIT_CARD' : 'PIX';
    const cleanCpf = params.customerCpf ? params.customerCpf.replace(/\D/g, '') : undefined;

    const payload = {
      customer: params.customerId,
      billingType,
      value: Number(params.amountBrl.toFixed(2)),
      dueDate: dueDateStr,
      description: params.description || `Roteiro Inteligente DUO21 | Serra Gaúcha`,
      externalReference: params.tripId
    };

    const paymentRes = await externalFetch(`${this.baseUrl}/payments`, {
      method: 'POST',
      headers: {
        'access_token': key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      timeoutMs: 10000,
      isIdempotent: false
    });

    if (!paymentRes.ok) {
      const errData = await paymentRes.json().catch(() => ({}));
      const desc = errData.errors?.[0]?.description || `Falha ao gerar cobrança no Asaas (${paymentRes.status})`;
      console.error('[Asaas] Create payment failed:', errData);
      throw new Error(desc);
    }

    const asaasPayment = await paymentRes.json();
    let pixQrCodeUrl = '';
    let pixCopyPaste = '';
    let pixExpiration = dueDate.toISOString();

    // If PIX, fetch the real QR code and copy-paste string from Asaas API
    if (billingType === 'PIX' && asaasPayment.id) {
      const qrRes = await externalFetch(`${this.baseUrl}/payments/${asaasPayment.id}/pixQrCode`, {
        headers: {
          'access_token': key
        },
        timeoutMs: 8000,
        isIdempotent: true,
        retries: 2
      });

      if (!qrRes.ok) {
        const errData = await qrRes.json().catch(() => ({}));
        const desc = errData.errors?.[0]?.description || `Falha ao obter QR Code PIX no Asaas (${qrRes.status})`;
        console.error('[Asaas] Error fetching pixQrCode:', errData);
        throw new Error(desc);
      }

      const qrData: PixQrCodeResponse = await qrRes.json();
      pixCopyPaste = qrData.payload;
      pixExpiration = qrData.expirationDate || pixExpiration;
      if (qrData.encodedImage) {
        pixQrCodeUrl = `data:image/png;base64,${qrData.encodedImage}`;
      } else if (pixCopyPaste) {
        pixQrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(pixCopyPaste)}`;
      }
    }

    return {
      id: orderId,
      trip_id: params.tripId,
      amount_brl: params.amountBrl,
      payment_method: params.paymentMethod,
      status: this.normalizeStatus(asaasPayment.status),
      asaas_payment_id: asaasPayment.id,
      asaas_customer_id: params.customerId,
      pix_qr_code: pixQrCodeUrl,
      pix_copy_paste: pixCopyPaste,
      pix_expiration_date: pixExpiration,
      customer_name: params.customerName,
      customer_email: params.customerEmail,
      customer_cpf: cleanCpf,
      created_at: nowIso,
      updated_at: nowIso,
      is_sandbox: this.isSandbox(),
      idempotency_key: params.idempotencyKey
    };
  }

  /**
   * Fetches payment details from Asaas.
   */
  public async getPayment(paymentId: string): Promise<any> {
    if (!this.isConfigured() || paymentId.startsWith('pay_sandbox_')) {
      return { id: paymentId, status: 'PENDING' };
    }

    try {
      const res = await externalFetch(`${this.baseUrl}/payments/${paymentId}`, {
        headers: { 'access_token': this.getApiKey() },
        timeoutMs: 6000,
        isIdempotent: true,
        retries: 1
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('[Asaas] Error fetching payment:', err);
    }
    return null;
  }

  /**
   * Cancels a payment in Asaas.
   */
  public async cancelPayment(paymentId: string): Promise<boolean> {
    if (!this.isConfigured() || paymentId.startsWith('pay_sandbox_')) {
      return true;
    }

    try {
      const res = await fetch(`${this.baseUrl}/payments/${paymentId}`, {
        method: 'DELETE',
        headers: { 'access_token': this.getApiKey() }
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Verifies status and returns normalized outcome.
   */
  public async verifyPaymentStatus(paymentId: string): Promise<{
    status: NormalizedPaymentStatus;
    isPaid: boolean;
    rawStatus?: string;
  }> {
    const payment = await this.getPayment(paymentId);
    if (!payment) {
      return { status: 'PENDING', isPaid: false };
    }
    const normalized = this.normalizeStatus(payment.status);
    return {
      status: normalized,
      isPaid: normalized === 'PAID' || normalized === 'CONFIRMED',
      rawStatus: payment.status
    };
  }

  /**
   * Validates and processes an incoming Asaas Webhook event.
   */
  public handleWebhook(body: any, tokenHeader?: string): WebhookResult {
    // 1. Verify token if configured
    const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN || this.webhookToken;
    if (expectedToken) {
      const receivedToken = tokenHeader || body?.webhookToken || body?.token;
      if (receivedToken !== expectedToken) {
        return {
          valid: false,
          event: '',
          paymentId: '',
          normalizedStatus: 'FAILED',
          isPaid: false,
          error: 'INVALID_WEBHOOK_TOKEN'
        };
      }
    }

    const event = body?.event || '';
    const payment = body?.payment || {};
    const paymentId = payment.id || body?.id || '';
    const tripId = payment.externalReference || body?.externalReference || undefined;
    const asaasStatus = payment.status || (event.includes('RECEIVED') || event.includes('CONFIRMED') ? 'RECEIVED' : 'PENDING');
    const normalizedStatus = this.normalizeStatus(asaasStatus);
    const isPaid = event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED' || normalizedStatus === 'PAID';

    return {
      valid: true,
      event,
      paymentId,
      tripId,
      normalizedStatus,
      isPaid
    };
  }
}

export const asaasServerProvider = new AsaasServerProvider();
