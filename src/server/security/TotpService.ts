/**
 * SPRINT 11 — DUO CONTROL: SERVIÇO CRIPTOGRÁFICO DE MFA / TOTP (RFC 6238)
 * 
 * Implementação nativa em Node.js com crypto padrão:
 * - Geração de segredo Base32 (RFC 4648)
 * - Cálculo e validação de TOTP com HMAC-SHA1 e janela de tolerância de deriva temporal (±30s)
 * - URI otpauth:// padrão para Google Authenticator, Authy, 1Password, etc.
 * - Códigos de recuperação de emergência (uso único, armazenados com hash SHA-256)
 */

import crypto from 'crypto';

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export class TotpService {
  /**
   * Converte Buffer binário para string Base32 (RFC 4648 sem padding)
   */
  public static base32Encode(buffer: Buffer): string {
    let bits = 0;
    let value = 0;
    let output = '';

    for (let i = 0; i < buffer.length; i++) {
      value = (value << 8) | buffer[i];
      bits += 8;

      while (bits >= 5) {
        output += BASE32_CHARS[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }

    if (bits > 0) {
      output += BASE32_CHARS[(value << (5 - bits)) & 31];
    }

    return output;
  }

  /**
   * Converte string Base32 para Buffer binário
   */
  public static base32Decode(base32Str: string): Buffer {
    const cleanStr = base32Str.toUpperCase().replace(/[\s=-]/g, '');
    let bits = 0;
    let value = 0;
    const bytes: number[] = [];

    for (let i = 0; i < cleanStr.length; i++) {
      const idx = BASE32_CHARS.indexOf(cleanStr[i]);
      if (idx === -1) continue;

      value = (value << 5) | idx;
      bits += 5;

      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }

    return Buffer.from(bytes);
  }

  /**
   * Gera um segredo aleatório criptograficamente seguro (20 bytes = 160 bits)
   */
  public static generateSecret(byteLength: number = 20): string {
    const randomBytes = crypto.randomBytes(byteLength);
    return this.base32Encode(randomBytes);
  }

  /**
   * Gera a URI padrão otpauth para escaneamento de QR Code
   */
  public static generateOtpauthUri(params: {
    secret: string;
    accountName: string;
    issuer?: string;
  }): string {
    const issuer = params.issuer || 'DUO21 Control';
    const account = encodeURIComponent(params.accountName);
    const encIssuer = encodeURIComponent(issuer);
    return `otpauth://totp/${encIssuer}:${account}?secret=${params.secret}&issuer=${encIssuer}&algorithm=SHA1&digits=6&period=30`;
  }

  /**
   * Calcula o token TOTP para um contador específico (RFC 6238 / RFC 4226 HOTP)
   */
  public static generateTokenForCounter(secretBase32: string, counter: number): string {
    const key = this.base32Decode(secretBase32);
    
    // Contador como inteiro de 8 bytes em Big Endian
    const counterBuf = Buffer.alloc(8);
    counterBuf.writeBigInt64BE(BigInt(counter), 0);

    const hmac = crypto.createHmac('sha1', key).update(counterBuf).digest();

    // Dynamic Truncation (RFC 4226)
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);

    const token = (binary % 1000000).toString().padStart(6, '0');
    return token;
  }

  /**
   * Valida o token TOTP com janela de tolerância de deriva temporal (±1 passo de 30 segundos)
   */
  public static verifyToken(secretBase32: string, token: string, windowSteps: number = 1): boolean {
    if (!token || typeof token !== 'string') return false;
    const cleanToken = token.trim();
    if (!/^\d{6}$/.test(cleanToken)) return false;

    const currentCounter = Math.floor(Date.now() / 1000 / 30);

    for (let errorStep = -windowSteps; errorStep <= windowSteps; errorStep++) {
      const expected = this.generateTokenForCounter(secretBase32, currentCounter + errorStep);
      if (crypto.timingSafeEqual(Buffer.from(cleanToken), Buffer.from(expected))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Gera códigos de recuperação de uso único (8 códigos de 12 caracteres formatados)
   */
  public static generateRecoveryCodes(count: number = 8): { rawCodes: string[]; hashedCodes: string[] } {
    const rawCodes: string[] = [];
    const hashedCodes: string[] = [];

    for (let i = 0; i < count; i++) {
      const raw = crypto.randomBytes(6).toString('hex').toUpperCase(); // 12 caracteres hex
      const formatted = `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
      const hash = crypto.createHash('sha256').update(formatted).digest('hex');

      rawCodes.push(formatted);
      hashedCodes.push(hash);
    }

    return { rawCodes, hashedCodes };
  }

  /**
   * Valida e consome um código de recuperação
   */
  public static verifyAndConsumeRecoveryCode(
    providedCode: string,
    existingHashedCodes: string[]
  ): { isValid: boolean; remainingHashedCodes: string[] } {
    if (!providedCode || !Array.isArray(existingHashedCodes)) {
      return { isValid: false, remainingHashedCodes: existingHashedCodes || [] };
    }

    const clean = providedCode.trim().toUpperCase();
    const providedHash = crypto.createHash('sha256').update(clean).digest('hex');

    const index = existingHashedCodes.findIndex(h => h === providedHash);
    if (index === -1) {
      return { isValid: false, remainingHashedCodes: existingHashedCodes };
    }

    // Remove o código utilizado (uso único)
    const remaining = [...existingHashedCodes];
    remaining.splice(index, 1);

    return { isValid: true, remainingHashedCodes: remaining };
  }
}
