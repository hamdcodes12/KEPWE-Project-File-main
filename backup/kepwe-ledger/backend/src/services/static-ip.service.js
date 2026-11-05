// Static IP readiness for Angel One SmartAPI order APIs.
//
// Angel One (SEBI retail-algo framework): order placement, modification,
// cancellation and GTT APIs are only executed when the request originates from
// a static IP registered against the SmartAPI key (SmartAPI portal > My Profile
// > My APIs; up to five IPs per key). SmartAPI exposes no endpoint to read the
// registered IPs back, so the registration itself cannot be confirmed by API.
//
// What CAN be verified, and is verified here:
//   1. ANGEL_ONE_STATIC_IP is configured, and
//   2. this server's real outbound IP (detected, never declared) equals it.
// A configured value is never compared with itself. If the IP is not registered
// with Angel One, Angel One itself rejects the order and that rejection is
// surfaced unchanged.

export const STATIC_IP_ENV = 'ANGEL_ONE_STATIC_IP';
const BROKER = 'ANGEL_ONE';
const VERIFY_TTL_MS = 10 * 60 * 1000;
const EGRESS_ENDPOINTS = [
  { url: 'https://api.ipify.org?format=json', read: (body) => JSON.parse(body).ip },
  { url: 'https://checkip.amazonaws.com', read: (body) => body.trim() },
];

let cached = null; // { at, result }

function text(value) {
  return String(value || '').trim();
}

function configuredIp() {
  return text(process.env[STATIC_IP_ENV]) || null;
}

/**
 * Synchronous readiness snapshot. Returns the most recent verified result when
 * one exists; otherwise NOT ready (never assumed).
 */
export function getStaticIpReadiness() {
  const configured = configuredIp();
  if (cached && cached.result.configuredIp === configured && Date.now() - cached.at < VERIFY_TTL_MS) {
    return cached.result;
  }
  return {
    broker: BROKER,
    configuredIp: configured,
    detectedIp: null,
    match: false,
    ready: false,
    verified: false,
    registrationVerifiable: false,
    status: configured ? 'PENDING_VERIFICATION' : 'NOT_CONFIGURED',
    reason: configured
      ? 'The configured static IP has not been checked against this server\'s outbound IP yet; live order execution stays blocked.'
      : `${STATIC_IP_ENV} is not configured; live order execution stays blocked.`,
  };
}

export async function detectEgressIp({ fetchImpl = fetch } = {}) {
  const errors = [];
  for (const endpoint of EGRESS_ENDPOINTS) {
    let timer;
    try {
      const controller = new AbortController();
      timer = setTimeout(() => controller.abort(), 5000);
      const response = await fetchImpl(endpoint.url, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = typeof response.text === 'function' ? await response.text() : JSON.stringify(await response.json());
      const ip = text(endpoint.read(body));
      if (/^[0-9a-f.:]+$/i.test(ip)) return { ip, source: new URL(endpoint.url).host };
      throw new Error('unrecognised response');
    } catch (error) {
      errors.push(`${new URL(endpoint.url).host}: ${error.message}`);
    } finally {
      clearTimeout(timer);
    }
  }
  const error = new Error(`Could not detect this server's outbound IP (${errors.join('; ')})`);
  error.code = 'EGRESS_IP_UNDETECTED';
  throw error;
}

/**
 * Verifies that this server's outbound IP equals ANGEL_ONE_STATIC_IP.
 * `ready` means "orders will leave from the configured static IP"; whether
 * that IP is registered against the SmartAPI key is enforced by Angel One.
 */
export async function verifyAngelOneStaticIp({ force = false, fetchImpl } = {}) {
  const configured = configuredIp();
  if (!force && cached && cached.result.configuredIp === configured && Date.now() - cached.at < VERIFY_TTL_MS) {
    return cached.result;
  }
  const base = {
    broker: BROKER,
    configuredIp: configured,
    detectedIp: null,
    detectedVia: null,
    match: false,
    ready: false,
    verified: false,
    registrationVerifiable: false,
  };
  let result;
  if (!configured) {
    result = { ...base, status: 'NOT_CONFIGURED', reason: `${STATIC_IP_ENV} is not configured; live order execution stays blocked.` };
  } else {
    try {
      const egress = await detectEgressIp(fetchImpl ? { fetchImpl } : {});
      const match = egress.ip === configured;
      result = {
        ...base,
        detectedIp: egress.ip,
        detectedVia: egress.source,
        match,
        ready: match,
        verified: true,
        status: match ? 'PASS' : 'EGRESS_IP_MISMATCH',
        reason: match
          ? `This server's outbound IP matches the configured static IP ${configured}. It must also be registered against the SmartAPI key in the Angel One SmartAPI portal; Angel One rejects orders from unregistered IPs.`
          : `The configured static IP is ${configured}, but this server's outbound IP is ${egress.ip}; Angel One would reject orders from this server.`,
      };
    } catch (error) {
      result = { ...base, status: 'EGRESS_UNVERIFIED', reason: error.message };
    }
  }
  result.verifiedAt = new Date().toISOString();
  result.verifiedAtMs = Date.now();
  cached = { at: Date.now(), result };
  return result;
}

export function clearStaticIpVerificationCache() {
  cached = null;
}
