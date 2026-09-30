// Static IP readiness for broker order APIs.
//
// Dhan: "Order Placement, Modification and Cancellation APIs require Static IP
// whitelisting" (dhanhq.co/docs/v2/orders). Readiness is only PASS when BOTH:
//   1. Dhan itself reports the configured IP as whitelisted (GET /v2/ip/getIP), and
//   2. this server's real outbound IP (detected, not declared) equals that IP.
// A configured value is never compared with itself.

const BROKER_IP_ENV = {
  DHAN: 'DHAN_STATIC_IP',
  ANGEL_ONE: 'ANGEL_ONE_STATIC_IP',
};
const VERIFY_TTL_MS = 10 * 60 * 1000;
const EGRESS_ENDPOINTS = [
  { url: 'https://api.ipify.org?format=json', read: (body) => JSON.parse(body).ip },
  { url: 'https://checkip.amazonaws.com', read: (body) => body.trim() },
];

const verified = new Map(); // key: `${broker}:${clientId}` -> { at, result }
let lastVerifiedByBroker = new Map(); // broker -> result (for sync readiness display)

function text(value) {
  return String(value || '').trim();
}

function configuredIpFor(broker) {
  return text(process.env[BROKER_IP_ENV[broker]]) || null;
}

/**
 * Synchronous readiness snapshot. Returns the most recent broker-verified
 * result when one exists; otherwise NOT ready (never assumed).
 */
export function getStaticIpReadiness(broker) {
  const configuredIp = configuredIpFor(broker);
  const last = lastVerifiedByBroker.get(broker);
  if (last && last.configuredIp === configuredIp && Date.now() - last.verifiedAtMs < VERIFY_TTL_MS) {
    return last;
  }
  return {
    broker,
    configuredIp,
    registeredIps: null,
    detectedIp: null,
    match: false,
    ready: false,
    verified: false,
    status: 'PENDING_EXTERNAL_CONFIGURATION',
    reason: configuredIp
      ? 'Static IP has not been verified with the broker and against this server\'s outbound IP yet; live order execution stays blocked.'
      : `${BROKER_IP_ENV[broker] || 'Static IP'} is not configured; live order execution stays blocked.`,
  };
}

export async function detectEgressIp({ fetchImpl = fetch } = {}) {
  const errors = [];
  for (const endpoint of EGRESS_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const response = await fetchImpl(endpoint.url, { signal: controller.signal });
      clearTimeout(timer);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = typeof response.text === 'function' ? await response.text() : JSON.stringify(await response.json());
      const ip = text(endpoint.read(body));
      if (/^[0-9a-f.:]+$/i.test(ip)) return { ip, source: new URL(endpoint.url).host };
      throw new Error('unrecognised response');
    } catch (error) {
      errors.push(`${new URL(endpoint.url).host}: ${error.message}`);
    }
  }
  const error = new Error(`Could not detect this server's outbound IP (${errors.join('; ')})`);
  error.code = 'EGRESS_IP_UNDETECTED';
  throw error;
}

/**
 * Broker-verified static IP check for Dhan. `adapter` must expose
 * getRegisteredStaticIps() (GET /v2/ip/getIP, which needs no whitelisting).
 */
export async function verifyDhanStaticIp(adapter, { force = false, fetchImpl } = {}) {
  const configuredIp = configuredIpFor('DHAN');
  const key = `DHAN:${adapter?.dhanClientId || 'unknown'}`;
  const cached = verified.get(key);
  if (!force && cached && cached.result.configuredIp === configuredIp && Date.now() - cached.at < VERIFY_TTL_MS) {
    return cached.result;
  }

  const base = { broker: 'DHAN', configuredIp, registeredIps: null, detectedIp: null, match: false, ready: false, verified: false };
  let result;
  if (!configuredIp) {
    result = { ...base, status: 'NOT_CONFIGURED', reason: 'DHAN_STATIC_IP is not configured; live order execution stays blocked.' };
  } else {
    let registered = null;
    let egress = null;
    let failure = null;
    try {
      registered = await adapter.getRegisteredStaticIps();
    } catch (error) {
      failure = { status: 'BROKER_CHECK_FAILED', reason: `Dhan GET /v2/ip/getIP failed: ${error.message}` };
    }
    if (!failure) {
      try {
        egress = await detectEgressIp(fetchImpl ? { fetchImpl } : {});
      } catch (error) {
        failure = { status: 'EGRESS_UNVERIFIED', reason: error.message };
      }
    }
    const registeredIps = registered ? [registered.primaryIP, registered.secondaryIP].map(text).filter(Boolean) : null;
    const registeredOk = Boolean(registeredIps?.includes(configuredIp));
    const egressOk = Boolean(egress && egress.ip === configuredIp);
    let status;
    let reason;
    if (failure) {
      ({ status, reason } = failure);
    } else if (!registeredOk) {
      status = 'NOT_WHITELISTED_WITH_DHAN';
      reason = registeredIps.length
        ? `Dhan has ${registeredIps.join(', ')} whitelisted, not the configured ${configuredIp}.`
        : 'Dhan reports no whitelisted static IP for this account.';
    } else if (!egressOk) {
      status = 'EGRESS_IP_MISMATCH';
      reason = `Dhan whitelists ${configuredIp}, but this server's outbound IP is ${egress.ip}; Dhan would reject orders from this server.`;
    } else {
      status = 'PASS';
      reason = `Dhan whitelists ${configuredIp} and this server's outbound IP matches.`;
    }
    result = {
      ...base,
      registeredIps,
      modifyDatePrimary: registered?.modifyDatePrimary ?? null,
      detectedIp: egress?.ip ?? null,
      detectedVia: egress?.source ?? null,
      match: registeredOk && egressOk,
      ready: status === 'PASS',
      verified: !failure,
      status,
      reason,
    };
  }
  result.verifiedAt = new Date().toISOString();
  result.verifiedAtMs = Date.now();
  verified.set(key, { at: Date.now(), result });
  lastVerifiedByBroker.set('DHAN', result);
  return result;
}

export function clearStaticIpVerificationCache() {
  verified.clear();
  lastVerifiedByBroker = new Map();
}
