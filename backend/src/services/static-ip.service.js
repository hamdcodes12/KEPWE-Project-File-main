const BROKER_IP_ENV = {
  DHAN: 'DHAN_STATIC_IP',
  ANGEL_ONE: 'ANGEL_ONE_STATIC_IP',
};

function text(value) {
  return String(value || '').trim();
}

export function getStaticIpReadiness(broker) {
  const configuredIp = text(process.env[BROKER_IP_ENV[broker]] || (broker === 'DHAN' ? process.env.DHAN_STATIC_IP : ''));
  const detectedIp = text(process.env.OUTBOUND_PUBLIC_IP || process.env.RENDER_OUTBOUND_IP);
  const match = Boolean(configuredIp && detectedIp && configuredIp === detectedIp);
  return {
    broker,
    configuredIp: configuredIp || null,
    detectedIp: detectedIp || null,
    match,
    ready: match,
    status: match ? 'PASS' : 'PENDING_EXTERNAL_CONFIGURATION',
    reason: match
      ? 'Configured broker IP matches the declared production outbound IP.'
      : 'Outbound IP detection or broker IP registration is not confirmed; live order execution must remain blocked.',
  };
}
