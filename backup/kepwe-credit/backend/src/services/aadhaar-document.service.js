import crypto from 'crypto';

/**
 * Aadhaar Document Security & Classification Service
 * Multi-layer security: file magic byte verification, size/mime sanitization,
 * document signal detection, front/back classification, and cross-consistency checks.
 */

// Magic byte signatures for authorized file types
const FILE_SIGNATURES = {
  'image/jpeg': [
    [0xff, 0xd8, 0xff],
  ],
  'image/jpg': [
    [0xff, 0xd8, 0xff],
  ],
  'image/png': [
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  ],
  'image/webp': [
    [0x52, 0x49, 0x46, 0x46], // "RIFF"
  ],
  'application/pdf': [
    [0x25, 0x50, 0x44, 0x46], // "%PDF"
  ],
};

const MAX_FILE_SIZE_BYTES = 6 * 1024 * 1024; // 6 MB
const MIN_FILE_SIZE_BYTES = 10 * 1024; // 10 KB to prevent empty/corrupt files

// Aadhaar Front Indicators
const FRONT_SIGNALS = [
  'government of india',
  'bharat sarkar',
  'unique identification authority of india',
  'uidai',
  'dob',
  'date of birth',
  'janam tithi',
  'year of birth',
  'yob',
  'male',
  'female',
  'transgender',
  'purush',
  'mahila',
  'mera aadhaar',
  'enrolment no',
  'enrollment no',
];

// Aadhaar Back Indicators
const BACK_SIGNALS = [
  'address',
  'pata',
  'c/o',
  's/o',
  'w/o',
  'd/o',
  'care of',
  '1947',
  'help@uidai.gov.in',
  'unique identification authority',
  'pincode',
  'pin code',
  'po:',
  'ps:',
  'dist:',
  'district',
  'state',
];

/**
 * Validate binary file security, magic numbers, and size constraints.
 */
export function validateFileSecurity(buffer, declaredMimeType) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    return { ok: false, error: 'Invalid file payload: not a valid buffer' };
  }

  if (buffer.length < MIN_FILE_SIZE_BYTES) {
    return { ok: false, error: 'File is too small or corrupted. Minimum file size is 10 KB.' };
  }

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: 'File exceeds the maximum limit of 6 MB.' };
  }

  const normalizedMime = (declaredMimeType || '').toLowerCase().trim();
  const validSignatures = FILE_SIGNATURES[normalizedMime];

  if (!validSignatures) {
    return { ok: false, error: 'Unsupported file format. Please upload JPG, PNG, WEBP, or PDF.' };
  }

  // Check actual magic bytes against buffer header
  const matchesSignature = validSignatures.some((signature) => {
    if (buffer.length < signature.length) return false;
    for (let i = 0; i < signature.length; i++) {
      if (buffer[i] !== signature[i]) return false;
    }
    return true;
  });

  if (!matchesSignature) {
    return {
      ok: false,
      error: 'File signature mismatch. The file content does not match its declared image format.',
    };
  }

  const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

  return {
    ok: true,
    fileSize: buffer.length,
    mimeType: normalizedMime,
    fileHash,
  };
}

/**
 * Analyze text & document signals to classify Aadhaar front vs back vs invalid.
 * If OCR text is provided, performs deep pattern matching.
 * Also handles simulated OCR from image text or sandbox metadata.
 */
export function classifyAadhaarDocument({
  side, // 'front' | 'back'
  extractedText = '',
  applicantName = '',
  expectedDob = '',
  aadhaarNumber = '',
  fileName = '',
}) {
  const textLower = (extractedText || '').toLowerCase();
  const nameLower = (applicantName || '').toLowerCase().trim();
  const rawAadhaar = (aadhaarNumber || '').replace(/\D/g, '');

  let frontScore = 0;
  let backScore = 0;
  const detectedSignals = [];

  // Front Signals Check
  for (const signal of FRONT_SIGNALS) {
    if (textLower.includes(signal)) {
      frontScore += 15;
      detectedSignals.push(signal);
    }
  }

  // Back Signals Check
  for (const signal of BACK_SIGNALS) {
    if (textLower.includes(signal)) {
      backScore += 15;
      detectedSignals.push(signal);
    }
  }

  // Aadhaar 12-digit or 3-quad formatting signal
  const aadhaarPattern = /\b\d{4}\s\d{4}\s\d{4}\b|\b\d{12}\b/;
  const hasAadhaarNumber = aadhaarPattern.test(extractedText);
  if (hasAadhaarNumber) {
    frontScore += 25;
    backScore += 10;
  }

  // DOB pattern signal (e.g. 15/05/1995 or 1995)
  const dobPattern = /\b(0[1-9]|[12]\d|3[01])[\/\-\.](0[1-9]|1[0-2])[\/\-\.](19\d{2}|20\d{2})\b|\b(19\d{2}|20\d{2})\b/;
  const hasDob = dobPattern.test(extractedText);
  if (hasDob) {
    frontScore += 25;
  }

  // Indian 6-digit Pincode signal (e.g. 400001, 110001)
  const pincodePattern = /\b[1-9][0-9]{5}\b/;
  const hasPincode = pincodePattern.test(extractedText);
  if (hasPincode) {
    backScore += 25;
  }

  // Applicant Name Presence
  let nameMatchConfidence = 0;
  if (nameLower && textLower.includes(nameLower)) {
    frontScore += 20;
    nameMatchConfidence = 95;
  } else if (nameLower) {
    // Check individual name parts (first name + surname)
    const nameParts = nameLower.split(/\s+/).filter(Boolean);
    const matchedParts = nameParts.filter((p) => p.length >= 3 && textLower.includes(p));
    if (matchedParts.length === nameParts.length && nameParts.length > 0) {
      frontScore += 15;
      nameMatchConfidence = 85;
    } else if (matchedParts.length > 0) {
      frontScore += 8;
      nameMatchConfidence = 60;
    }
  }

  // If text is minimal (e.g. file without OCR payload or demo sandbox),
  // check filename signals and structural integrity
  const fileLower = (fileName || '').toLowerCase();
  const isAadhaarNamed = fileLower.includes('aadhaar') || fileLower.includes('aadhar') || fileLower.includes('uidai') || fileLower.includes('kyc');

  if (isAadhaarNamed) {
    if (side === 'front' && (fileLower.includes('front') || !fileLower.includes('back'))) {
      frontScore += 45;
    } else if (side === 'back' && (fileLower.includes('back') || !fileLower.includes('front'))) {
      backScore += 45;
    } else {
      frontScore += 25;
      backScore += 25;
    }
  }

  // Normalize scores between 0 and 100
  const normalizedFront = Math.min(100, frontScore);
  const normalizedBack = Math.min(100, backScore);

  let classification = 'INVALID';
  let confidence = 0;

  if (normalizedFront >= 50 && normalizedFront >= normalizedBack) {
    classification = 'AADHAAR_FRONT';
    confidence = normalizedFront;
  } else if (normalizedBack >= 50 && normalizedBack > normalizedFront) {
    classification = 'AADHAAR_BACK';
    confidence = normalizedBack;
  }

  // Expected vs Detected Side Validation
  if (side === 'front') {
    if (classification === 'AADHAAR_BACK') {
      return {
        ok: false,
        classification,
        confidence,
        error: 'Wrong document side uploaded. You uploaded the Aadhaar Back (Address side) in the Front photo slot. Please upload the Front photo with your photo & name.',
      };
    }
    if (classification !== 'AADHAAR_FRONT' || confidence < 50) {
      return {
        ok: false,
        classification: 'INVALID',
        confidence,
        error: 'This image does not appear to be a valid Aadhaar front document. Please upload a clear photo of your Aadhaar card showing your photo, name, and 12-digit number.',
      };
    }
  } else if (side === 'back') {
    if (classification === 'AADHAAR_FRONT') {
      return {
        ok: false,
        classification,
        confidence,
        error: 'Wrong document side uploaded. You uploaded the Aadhaar Front photo in the Back slot. Please upload the Back photo showing your address & QR code.',
      };
    }
    if (classification !== 'AADHAAR_BACK' || confidence < 50) {
      return {
        ok: false,
        classification: 'INVALID',
        confidence,
        error: 'This image does not appear to be a valid Aadhaar back document. Please upload a clear photo of your Aadhaar card showing your address and QR code.',
      };
    }
  }

  return {
    ok: true,
    classification,
    confidence,
    detectedSignals,
    nameMatchConfidence,
    extractedData: {
      hasAadhaarNumber,
      hasDob,
      hasPincode,
      maskedAadhaar: rawAadhaar ? `XXXX XXXX ${rawAadhaar.slice(-4)}` : null,
    },
  };
}
