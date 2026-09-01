import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { pool } from '../config/db.js';
import { optionalAuth, validateBody } from '../middleware/auth.js';
import { logServerError } from '../lib/safe-logger.js';
import { validateFileSecurity, classifyAadhaarDocument } from '../services/aadhaar-document.service.js';
import { kycProviderService, validateVerhoeffChecksum } from '../services/kyc-provider.service.js';

const router = Router();

// Rate limiters for KYC endpoints
const documentValidationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many document upload attempts. Please wait a few minutes before trying again.' },
});

const otpInitiateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many OTP requests. Please wait 15 minutes before requesting again.' },
});

const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many OTP verification attempts. Please wait before trying again.' },
});

// Zod Validation Schemas
const validateDocSchema = z.object({
  side: z.enum(['front', 'back']),
  fileBase64: z.string().min(100, 'Invalid file payload'),
  mimeType: z.string().min(3),
  fileName: z.string().optional(),
  applicantName: z.string().optional(),
  aadhaarNumber: z.string().optional(),
  dob: z.string().optional(),
});

const initiateOtpSchema = z.object({
  aadhaarNumber: z.string().min(12).max(14),
  applicantName: z.string().min(2, 'Applicant name is required').max(255),
  dob: z.string().min(4, 'Date of birth is required'),
  panNumber: z.string().optional(),
  sessionId: z.string().optional(),
});

const verifyOtpSchema = z.object({
  transactionId: z.string().min(5),
  otp: z.string().regex(/^\d{6}$/, 'OTP must be a 6-digit number'),
  applicantName: z.string().optional(),
  dob: z.string().optional(),
});

/**
 * POST /api/kyc/aadhaar/validate-document
 * Server-side binary security check + Aadhaar classifier & OCR analysis
 */
router.post('/aadhaar/validate-document', documentValidationLimiter, validateBody(validateDocSchema), async (req, res) => {
  try {
    const { side, fileBase64, mimeType, fileName, applicantName, aadhaarNumber, dob } = req.validatedBody;

    // Clean base64 header if present
    const base64Data = fileBase64.replace(/^data:([A-Za-z-+\/]+);base64,/, '');
    const fileBuffer = Buffer.from(base64Data, 'base64');

    // 1. Binary Security & Magic Byte check
    const secCheck = validateFileSecurity(fileBuffer, mimeType);
    if (!secCheck.ok) {
      return res.status(400).json({
        ok: false,
        error: secCheck.error,
        side,
      });
    }

    // Extract ASCII/printable strings from buffer payload/metadata for document classifier
    const extractedStrings = fileBuffer
      .toString('latin1')
      .replace(/[^\x20-\x7E\n]/g, ' ')
      .replace(/\s+/g, ' ');

    // 2. Classify Document & Detect Aadhaar Signals
    const classificationResult = classifyAadhaarDocument({
      side,
      extractedText: extractedStrings,
      applicantName,
      expectedDob: dob,
      aadhaarNumber,
      fileName: fileName || `${side}.jpg`,
    });

    if (!classificationResult.ok) {
      return res.status(422).json({
        ok: false,
        side,
        classification: classificationResult.classification,
        confidence: classificationResult.confidence,
        error: classificationResult.error,
      });
    }

    return res.json({
      ok: true,
      side,
      classification: classificationResult.classification,
      confidence: classificationResult.confidence,
      fileHash: secCheck.fileHash,
      fileSize: secCheck.fileSize,
      extractedData: classificationResult.extractedData,
      message: `Aadhaar ${side === 'front' ? 'Front' : 'Back'} document validated successfully.`,
    });
  } catch (err) {
    logServerError('aadhaar_validate_document_error', err, { method: req.method, path: req.path });
    return res.status(500).json({
      ok: false,
      error: 'An error occurred during document validation. Please check the file and try again.',
    });
  }
});

/**
 * POST /api/kyc/aadhaar/initiate
 * Structural check + KYC Provider OTP initiation to UIDAI-linked mobile
 */
router.post('/aadhaar/initiate', otpInitiateLimiter, optionalAuth, validateBody(initiateOtpSchema), async (req, res) => {
  try {
    const { aadhaarNumber, applicantName, dob, panNumber, sessionId } = req.validatedBody;
    const cleanAadhaar = aadhaarNumber.replace(/\D/g, '');

    if (cleanAadhaar.length !== 12) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid Aadhaar number. Must be exactly 12 digits.',
      });
    }

    // Structural Verhoeff Checksum Check
    const passesVerhoeff = validateVerhoeffChecksum(cleanAadhaar);
    if (!passesVerhoeff) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid Aadhaar number checksum. Please check your 12-digit number.',
      });
    }

    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress;

    // Call KYC Provider Orchestrator
    const result = await kycProviderService.initiateAadhaarOtp({
      aadhaarNumber: cleanAadhaar,
      applicantName,
      dob,
      panNumber,
      clientIp,
      sessionId,
      userId: req.userId || null,
    });

    // Store in Database Audit Log if pool is connected
    try {
      await pool.query(
        `INSERT INTO aadhaar_kyc_verifications
           (session_id, user_id, client_ip, applicant_name, pan_number, aadhaar_number_masked, aadhaar_hash, dob, mobile_masked, status, provider_name, provider_tx_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'OTP_SENT', $10, $11)`,
        [
          sessionId || null,
          req.userId || null,
          clientIp || null,
          applicantName,
          panNumber || null,
          result.maskedAadhaar,
          result.maskedAadhaar, // secure placeholder hash
          dob,
          result.maskedMobile,
          result.provider,
          result.transactionId,
        ]
      );
    } catch (dbErr) {
      // Graceful DB log fallback
      console.warn('[KYC DB audit warn]', dbErr.message);
    }

    return res.json({
      ok: true,
      transactionId: result.transactionId,
      maskedAadhaar: result.maskedAadhaar,
      maskedMobile: result.maskedMobile,
      provider: result.provider,
      expiresAt: result.expiresAt,
      resendAvailableInSeconds: result.resendAvailableInSeconds,
      demoOtpHint: result.demoOtpHint,
      message: `OTP sent to Aadhaar-registered mobile ${result.maskedMobile}`,
    });
  } catch (err) {
    logServerError('aadhaar_initiate_error', err, { method: req.method, path: req.path });
    return res.status(400).json({
      ok: false,
      error: err.message || 'Unable to initiate Aadhaar verification. Please try again.',
    });
  }
});

/**
 * POST /api/kyc/aadhaar/verify-otp
 * Submits 6-digit OTP to KYC Provider and Cross-validates Name & DOB
 */
router.post('/aadhaar/verify-otp', otpVerifyLimiter, optionalAuth, validateBody(verifyOtpSchema), async (req, res) => {
  try {
    const { transactionId, otp, applicantName, dob } = req.validatedBody;

    // Verify OTP & Cross-verify Identity with KYC Provider
    const result = await kycProviderService.verifyAadhaarOtp({
      transactionId,
      otp,
      applicantName,
      dob,
    });

    // Update DB record
    try {
      await pool.query(
        `UPDATE aadhaar_kyc_verifications
         SET status = 'VERIFIED',
             name_match_score = $1,
             dob_match = $2,
             verification_token = $3,
             verified_at = NOW(),
             updated_at = NOW()
         WHERE provider_tx_id = $4`,
        [result.nameMatchScore, result.dobMatch, result.verificationToken, transactionId]
      );
    } catch (dbErr) {
      console.warn('[KYC DB verify warn]', dbErr.message);
    }

    return res.json({
      ok: true,
      verified: true,
      transactionId: result.transactionId,
      maskedAadhaar: result.maskedAadhaar,
      verifiedName: result.verifiedName,
      verifiedDob: result.verifiedDob,
      maskedMobile: result.maskedMobile,
      verificationToken: result.verificationToken,
      verifiedAt: result.verifiedAt,
      message: 'Aadhaar e-KYC verified successfully.',
    });
  } catch (err) {
    logServerError('aadhaar_verify_otp_error', err, { method: req.method, path: req.path });
    return res.status(400).json({
      ok: false,
      verified: false,
      error: err.message || 'Aadhaar OTP verification failed.',
    });
  }
});

export default router;
