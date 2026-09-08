function safeMessage(value) {
  return String(value || 'Unknown error')
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[REDACTED_DATABASE_URL]')
    .replace(/bearer\s+[\w.-]+/gi, 'Bearer [REDACTED]')
    .replace(/(jwt|token|secret|password)=?[^\s,;]+/gi, '$1=[REDACTED]');
}
export function logServerError(event, err, context = {}) {
  const payload = {
    level: 'error',
    event,
    requestId: context.requestId || null,
    method: context.method || null,
    path: context.path || null,
    error: {
      name: err?.name || 'Error',
      message: safeMessage(err?.message),
      code: err?.code || err?.statusCode || null,
    },
  };

  // Do not add request bodies, authorization headers, passwords, tokens, or env values here.
  console.error(JSON.stringify(payload));
}
