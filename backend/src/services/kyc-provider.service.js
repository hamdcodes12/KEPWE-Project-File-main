import crypto from 'crypto';
import jwt from 'jsonwebtoken';

/**
 * Verhoeff Checksum Algorithm Implementation
 * Validates the 12th checksum digit of Indian Aadhaar numbers.
 */
const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

const VERHOEFF_INV = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

export function generateVerhoeffChecksum(numStr11) {
  let c = 0;
  const clean = (numStr11 || '').replace(/\D/g, '').slice(0, 11);
  const reversed = clean.split('').reverse().map(Number);
  for (let i = 0; i < reversed.length; i++) {
    c = VERHOEFF_D[c][VERHOEFF_P[(i + 1) % 8][reversed[i]]];
  }
  return clean + VERHOEFF_INV[c];
}

export function validateVerhoeffChecksum(aadhaarString) {
  const clean = (aadhaarString || '').replace(/\D/g, '');
  if (clean.length !== 12) return false;
  if (/^[01]/.test(clean)) return false; // First digit of Aadhaar cannot be 0 or 1

  let c = 0;
  const reversed = clean.split('').reverse().map(Number);
  for (let i = 0; i < reversed.length; i++) {
    c = VERHOEFF_D[c][VERHOEFF_P[i % 8][reversed[i]]];
  }
  return c === 0;
}

/**
 * Server-side Name Normalization & Similarity Check
 */
export function normalizeName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\b(mr|mrs|ms|shri|smt|dr|prof)\b\.?/gi, '')
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function calculateNameMatchScore(name1, name2) {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);

  if (!n1 || !n2) return 0;
  if (n1 === n2) return 100;

  const tokens1 = n1.split(' ').filter(Boolean).sort();
  const tokens2 = n2.split(' ').filter(Boolean).sort();

  if (tokens1.join(' ') === tokens2.join(' ')) return 95;

  // Check token intersection
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);
  let matchingTokens = 0;
  for (const t of set1) {
    if (set2.has(t)) matchingTokens++;
  }

  const tokenScore = (matchingTokens / Math.max(set1.size, set2.size)) * 100;
  return Math.round(tokenScore);
}

/**
 * Server-side Date Normalization (YYYY-MM-DD)
 */
export function normalizeDate(dateStr) {
  if (!dateStr) return null;
  const clean = String(dateStr).trim();

  // Format: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }

  // Format: DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return null;
}

// In-Memory Secure OTP Session Cache for Sandbox (10 min TTL)
const sandboxOtpStore = new Map();

/**
 * Authorized KYC Provider Orchestrator
 */
class KYCProviderService {
  constructor() {
    this.provider = (process.env.KYC_PROVIDER || '').toLowerCase() || (process.env.NODE_ENV === 'production' ? '' : 'sandbox');
    this.apiKey = process.env.KYC_API_KEY || '';
    this.apiSecret = process.env.KYC_API_SECRET || '';
    this.baseUrl = process.env.KYC_BASE_URL || '';
  }

  /**
   * Initiate Aadhaar OTP Verification
   */
  async initiateAadhaarOtp({ aadhaarNumber, applicantName, dob, panNumber, clientIp, sessionId, userId }) {
    const cleanAadhaar = (aadhaarNumber || '').replace(/\D/g, '');
    const cleanName = (applicantName || '').trim();
    const normalizedDob = normalizeDate(dob);

    if (cleanAadhaar.length !== 12) {
      throw new Error('Aadhaar number must be exactly 12 digits');
    }

    if (!cleanName || cleanName.length < 3) {
      throw new Error('Valid applicant name is required');
    }

    if (!normalizedDob) {
      throw new Error('Valid date of birth is required');
    }

    // Check Production Configuration
    if (process.env.NODE_ENV === 'production' && (!this.provider || this.provider === 'sandbox')) {
      throw new Error('Aadhaar KYC verification service is not configured. Authorized KYC provider credentials are required in production.');
    }

    const transactionId = `tx_kyc_${crypto.randomBytes(12).toString('hex')}`;
    const maskedAadhaar = `XXXX XXXX ${cleanAadhaar.slice(-4)}`;
    const aadhaarHash = crypto.createHash('sha256').update(cleanAadhaar + (process.env.JWT_SECRET || 'kepwe_salt')).digest('hex');

    // ── Sandbox / Development Provider ──
    if (this.provider === 'sandbox' || process.env.NODE_ENV !== 'production') {
      const demoOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      const resendAvailableAt = new Date(Date.now() + 30 * 1000); // 30 seconds

      // Derive consistent masked mobile from Aadhaar last digits for UIDAI simulation
      const lastDigits = cleanAadhaar.slice(-4);
      const maskedMobile = `+91 ******${lastDigits}`;

      sandboxOtpStore.set(transactionId, {
        transactionId,
        aadhaarNumber: cleanAadhaar,
        maskedAadhaar,
        aadhaarHash,
        applicantName: cleanName,
        dob: normalizedDob,
        panNumber,
        maskedMobile,
        otp: demoOtp,
        attempts: 0,
        maxAttempts: 3,
        expiresAt,
        resendAvailableAt,
        verified: false,
        createdAt: new Date(),
      });

      return {
        ok: true,
        transactionId,
        maskedAadhaar,
        maskedMobile,
        provider: 'sandbox',
        expiresAt: expiresAt.toISOString(),
        resendAvailableInSeconds: 30,
        // In sandbox only, we include simulation hint for authorized dev testing
        demoOtpHint: process.env.NODE_ENV !== 'production' ? demoOtp : undefined,
      };
    }

    // ── External Provider Integration (e.g. Cashfree / Setu / Karza / Decentro) ──
    if (this.provider === 'cashfree') {
      // Call Cashfree /verification/offline-aadhaar/otp
      const response = await fetch(`${this.baseUrl}/verification/offline-aadhaar/otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': this.apiKey,
          'x-client-secret': this.apiSecret,
        },
        body: JSON.stringify({ aadhaar_number: cleanAadhaar }),
      });

      const resData = await response.json();
      if (!response.ok || resData.status !== 'SUCCESS') {
        throw new Error(resData.message || 'Failed to initiate Aadhaar OTP with verification provider');
      }

      return {
        ok: true,
        transactionId: resData.ref_id || transactionId,
        maskedAadhaar,
        maskedMobile: resData.masked_mobile || `+91 ******${cleanAadhaar.slice(-4)}`,
        provider: 'cashfree',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        resendAvailableInSeconds: 30,
      };
    }

    throw new Error(`Unsupported KYC provider: ${this.provider}`);
  }

  /**
   * Verify Aadhaar OTP and Cross-Validate Identity Server-Side
   */
  async verifyAadhaarOtp({ transactionId, otp, applicantName, dob }) {
    if (!transactionId) {
      throw new Error('Transaction ID is required');
    }
    const cleanOtp = String(otp || '').trim();
    if (!/^\d{6}$/.test(cleanOtp)) {
      throw new Error('OTP must be exactly 6 digits');
    }

    // ── Sandbox Verification ──
    if (this.provider === 'sandbox' || process.env.NODE_ENV !== 'production') {
      const record = sandboxOtpStore.get(transactionId);
      if (!record) {
        throw new Error('Invalid or expired Aadhaar verification session. Please request a new OTP.');
      }

      if (Date.now() > record.expiresAt.getTime()) {
        sandboxOtpStore.delete(transactionId);
        throw new Error('OTP has expired. Please request a new OTP.');
      }

      if (record.attempts >= record.maxAttempts) {
        sandboxOtpStore.delete(transactionId);
        throw new Error('Maximum OTP verification attempts exceeded. Please start a new verification.');
      }

      record.attempts += 1;

      // Verify OTP match
      if (cleanOtp !== record.otp) {
        const remaining = record.maxAttempts - record.attempts;
        throw new Error(
          remaining > 0
            ? `Invalid OTP. ${remaining} attempt${remaining > 1 ? 's' : ''} remaining.`
            : 'Maximum OTP attempts exceeded. Please request a new OTP.'
        );
      }

      // Cross-verify Name with Applicant Record
      const expectedName = applicantName || record.applicantName;
      const verifiedProfileName = record.applicantName; // From UIDAI record
      const nameScore = calculateNameMatchScore(expectedName, verifiedProfileName);

      if (nameScore < 70) {
        record.verified = false;
        throw new Error(`Name mismatch: Applicant name '${expectedName}' does not match the name registered on Aadhaar.`);
      }

      // Cross-verify DOB with Applicant Record
      const expectedDob = normalizeDate(dob || record.dob);
      const verifiedDob = normalizeDate(record.dob);

      if (expectedDob !== verifiedDob) {
        record.verified = false;
        throw new Error(`Date of birth mismatch: Entered DOB '${expectedDob}' does not match the DOB registered on Aadhaar.`);
      }

      record.verified = true;

      // Generate signed tamper-proof Verification JWT
      const jwtSecret = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'kepwe_kyc_secret_token_key_12345';
      const verificationToken = jwt.sign(
        {
          sub: record.transactionId,
          type: 'aadhaar_kyc_verified',
          aadhaarHash: record.aadhaarHash,
          maskedAadhaar: record.maskedAadhaar,
          verifiedName: record.applicantName,
          verifiedDob: record.dob,
          verifiedAt: new Date().toISOString(),
        },
        jwtSecret,
        { expiresIn: '24h' }
      );

      return {
        ok: true,
        verified: true,
        transactionId: record.transactionId,
        maskedAadhaar: record.maskedAadhaar,
        verifiedName: record.applicantName,
        verifiedDob: record.dob,
        maskedMobile: record.maskedMobile,
        nameMatchScore: nameScore,
        dobMatch: true,
        verificationToken,
        verifiedAt: new Date().toISOString(),
      };
    }

    // ── External Provider Verification ──
    if (this.provider === 'cashfree') {
      const response = await fetch(`${this.baseUrl}/verification/offline-aadhaar/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': this.apiKey,
          'x-client-secret': this.apiSecret,
        },
        body: JSON.stringify({
          ref_id: transactionId,
          otp: cleanOtp,
        }),
      });

      const resData = await response.json();
      if (!response.ok || resData.status !== 'VALID') {
        throw new Error(resData.message || 'Aadhaar OTP verification failed with provider');
      }

      const verifiedName = resData.name || '';
      const verifiedDob = normalizeDate(resData.dob);

      const nameScore = calculateNameMatchScore(applicantName, verifiedName);
      if (nameScore < 70) {
        throw new Error('Name mismatch: Applicant name does not match the verified Aadhaar profile');
      }

      const expectedDob = normalizeDate(dob);
      if (expectedDob && verifiedDob && expectedDob !== verifiedDob) {
        throw new Error('Date of birth mismatch: Entered DOB does not match the verified Aadhaar profile');
      }

      const jwtSecret = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'kepwe_kyc_secret_token_key_12345';
      const verificationToken = jwt.sign(
        {
          sub: transactionId,
          type: 'aadhaar_kyc_verified',
          maskedAadhaar: resData.masked_aadhaar || `XXXX XXXX ${transactionId.slice(-4)}`,
          verifiedName,
          verifiedDob,
          verifiedAt: new Date().toISOString(),
        },
        jwtSecret,
        { expiresIn: '24h' }
      );

      return {
        ok: true,
        verified: true,
        transactionId,
        maskedAadhaar: resData.masked_aadhaar || `XXXX XXXX ${transactionId.slice(-4)}`,
        verifiedName,
        verifiedDob,
        maskedMobile: resData.masked_mobile,
        nameMatchScore: nameScore,
        dobMatch: true,
        verificationToken,
        verifiedAt: new Date().toISOString(),
      };
    }

    throw new Error(`Unsupported KYC provider: ${this.provider}`);
  }
}

export const kycProviderService = new KYCProviderService();
