import React, { useState } from 'react';
import { 
  X, 
  QrCode, 
  CreditCard, 
  Copy, 
  Check, 
  ShieldCheck, 
  Sparkles, 
  Clock, 
  AlertCircle,
  Mail,
  User
} from 'lucide-react';
import { Trip, TripPreview, PaymentMethod } from '../types';
import { paymentProvider } from '../services/payment/PaymentProvider';
import { trackEvent } from '../services/analytics';

interface CheckoutModalProps {
  trip?: Trip | null;
  preview?: TripPreview | null;
  onClose: () => void;
  onPaymentSuccess: (token: string, email: string) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  trip,
  preview,
  onClose,
  onPaymentSuccess
}) => {
  const preferences = preview?.preferences || trip?.preferences;
  const priceBrl = preview?.price_brl || trip?.price_brl || 37;
  const tripId = trip?.id || preview?.id || `trip_${Date.now()}`;
  const secureToken = trip?.secure_token || `tok_${Math.random().toString(36).substring(2, 9)}`;

  const [method, setMethod] = useState<PaymentMethod>('pix');
  const [customerName, setCustomerName] = useState(preferences?.name || '');
  const [customerEmail, setCustomerEmail] = useState(preferences?.email || '');
  const [copiedPix, setCopiedPix] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderCreated, setOrderCreated] = useState(false);
  const [pixCopyCode, setPixCopyCode] = useState('');
  const [pixQrCodeUrl, setPixQrCodeUrl] = useState('');

  const handleStartCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerEmail || !customerName) return;

    setIsProcessing(true);
    trackEvent('checkout_started', { amount: priceBrl, method });

    try {
      const order = await paymentProvider.createOrder({
        tripId: tripId,
        amountBrl: priceBrl,
        paymentMethod: method,
        customerName,
        customerEmail
      });

      if (order.pix_copy_paste) {
        setPixCopyCode(order.pix_copy_paste);
      }
      if (order.pix_qr_code) {
        setPixQrCodeUrl(order.pix_qr_code);
      }

      setOrderCreated(true);
      setIsProcessing(false);
    } catch {
      setIsProcessing(false);
    }
  };

  const handleSimulateInstantApproval = () => {
    setIsProcessing(true);
    trackEvent('payment_completed', { tripId: tripId });

    setTimeout(() => {
      onPaymentSuccess(secureToken, customerEmail);
    }, 800);
  };

  const handleCopyPix = () => {
    if (pixCopyCode) {
      navigator.clipboard.writeText(pixCopyCode);
      setCopiedPix(true);
      setTimeout(() => setCopiedPix(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto">
      <div 
        className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom duration-200"
        id="modal-checkout-asaas"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 bg-[#FAF9F6] border-b border-[#E7DFCE] flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A6F5D]">
              Checkout Seguro • DUO21
            </span>
            <h3 className="text-base font-extrabold text-[#1B4332]">
              Desbloquear Acesso Completo
            </h3>
          </div>

          <button
            id="btn-close-checkout"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Summary Box */}
          <div className="bg-[#FAF9F6] p-3.5 rounded-2xl border border-[#E7DFCE] flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-[#1E293B] block">
                Roteiro {trip.days.length} Dias (Serra Gaúcha)
              </span>
              <span className="text-[11px] text-[#64748B]">
                Gramado, Canela e Nova Petrópolis
              </span>
            </div>

            <div className="text-right">
              <span className="text-lg font-black text-[#1B4332]">
                R$ {trip.price_brl.toFixed(2).replace('.', ',')}
              </span>
              <span className="text-[10px] text-[#7A6F5D] block">Pagamento único</span>
            </div>
          </div>

          {!orderCreated ? (
            <form onSubmit={handleStartCheckout} className="space-y-3.5">
              {/* Customer Info */}
              <div>
                <label className="block text-xs font-semibold text-[#1B4332] mb-1">
                  Seu Nome Completo
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    id="input-checkout-name"
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Como você quer ser chamado"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E7DFCE] focus:border-[#1B4332] focus:ring-2 focus:ring-[#1B4332]/15 text-sm outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B4332] mb-1">
                  Seu Melhor E-mail (para envio do link seguro)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    id="input-checkout-email"
                    type="email"
                    required
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="seuemail@exemplo.com"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E7DFCE] focus:border-[#1B4332] focus:ring-2 focus:ring-[#1B4332]/15 text-sm outline-none"
                  />
                </div>
                <span className="text-[10px] text-[#64748B] mt-1 block">
                  Você não precisa de senha. Seu roteiro ficará vinculado a este e-mail.
                </span>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="block text-xs font-semibold text-[#1B4332] mb-1.5">
                  Forma de Pagamento
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMethod('pix')}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                      method === 'pix' 
                        ? 'bg-[#EBF3EE] border-[#1B4332] text-[#1B4332] font-bold shadow-sm ring-1 ring-[#1B4332]' 
                        : 'bg-white border-[#E7DFCE] text-[#64748B]'
                    }`}
                  >
                    <QrCode className="w-5 h-5" />
                    <span className="text-xs">PIX (Imediato)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMethod('credit_card')}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                      method === 'credit_card' 
                        ? 'bg-[#EBF3EE] border-[#1B4332] text-[#1B4332] font-bold shadow-sm ring-1 ring-[#1B4332]' 
                        : 'bg-white border-[#E7DFCE] text-[#64748B]'
                    }`}
                  >
                    <CreditCard className="w-5 h-5" />
                    <span className="text-xs">Cartão de Crédito</span>
                  </button>
                </div>
              </div>

              <button
                id="btn-generate-payment"
                type="submit"
                disabled={isProcessing || !customerEmail || !customerName}
                className="w-full py-3.5 bg-[#1B4332] hover:bg-[#2D6A4F] disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2"
              >
                {isProcessing ? 'Gerando cobrança segura...' : `Pagar R$ ${priceBrl.toFixed(2).replace('.', ',')} e Desbloquear`}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              {/* PIX Payment Box */}
              {method === 'pix' && (
                <div className="text-center space-y-3 bg-[#FAF9F6] p-4 rounded-2xl border border-[#E7DFCE]">
                  <span className="text-xs font-bold text-[#1B4332] flex items-center justify-center gap-1">
                    <Clock className="w-4 h-4 text-emerald-600" />
                    Aguardando confirmação do PIX
                  </span>

                  {pixQrCodeUrl && (
                    <div className="mx-auto w-44 h-44 bg-white p-2 rounded-xl shadow-sm border border-[#E7DFCE] flex items-center justify-center">
                      <img 
                        src={pixQrCodeUrl} 
                        alt="QR Code PIX Asaas" 
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}

                  <p className="text-xs text-[#64748B]">
                    Abra o app do seu banco e escaneie o código acima ou copie o código abaixo:
                  </p>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={pixCopyCode}
                      className="flex-1 bg-white text-xs text-[#1E293B] px-3 py-2 rounded-xl border border-[#E7DFCE] outline-none"
                    />
                    <button
                      id="btn-copy-pix-code"
                      type="button"
                      onClick={handleCopyPix}
                      className="px-3 py-2 bg-[#1B4332] hover:bg-[#2D6A4F] text-white text-xs font-bold rounded-xl flex items-center gap-1 transition-colors"
                    >
                      {copiedPix ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedPix ? 'Copiado!' : 'Copiar'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Dev Sandbox Simulator */}
              <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-200 text-left space-y-2">
                <div className="flex items-center gap-1.5 text-amber-800 font-bold text-xs">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span>Ambiente Sandbox / Modo Teste</span>
                </div>
                <p className="text-[11px] text-amber-900 leading-relaxed">
                  Para fins de teste e demonstração imediata no ambiente de desenvolvimento, você pode simular a confirmação instantânea do webhook de pagamento:
                </p>
                <button
                  id="btn-simulate-instant-payment"
                  type="button"
                  onClick={handleSimulateInstantApproval}
                  disabled={isProcessing}
                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow transition-colors flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Simular Pagamento Confirmado (Webhook Asaas)</span>
                </button>
              </div>
            </div>
          )}

          <div className="pt-2 flex items-center justify-center gap-2 text-[11px] text-[#7A6F5D]">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Pagamento processado via Asaas Pagamentos • DUO21</span>
          </div>
        </div>
      </div>
    </div>
  );
};
