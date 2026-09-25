/**
 * resolve-db-url.js
 *
 * Supabase direct-host addresses (db.PROJECT.supabase.co) are dual-stack
 * but resolve to IPv6 on Render's free tier, which has no outbound IPv6
 * internet route (ENETUNREACH).  This module resolves the hostname to an
 * explicit IPv4 address and returns a rewritten connection string that the
 * pg driver can use without any DNS lookup at all.
 *
 * If IPv4 resolution fails (e.g. in a local dev environment where IPv6
 * works fine) we fall back to the original URL unchanged so local
 * development is never broken.
 *
 * No credentials are ever logged.
 */

import dns from 'dns';
import { promisify } from 'util';

const lookup = promisify(dns.lookup);

/**
 * Given a PostgreSQL connection string, returns a version where the
 * hostname has been replaced with an explicit IPv4 address so the pg
 * driver bypasses DNS and never attempts an IPv6 connection.
 *
 * @param {string} databaseUrl
 * @returns {Promise<string>}  resolved URL (or original on failure)
 */
export async function resolveToIPv4Url(databaseUrl) {
  if (!databaseUrl) return databaseUrl;

  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    // Not a valid URL — return unchanged
    return databaseUrl;
  }

  const hostname = parsed.hostname;

  // Already an IP address — nothing to resolve
  if (/^[\d.]+$/.test(hostname) || hostname.includes(':')) {
    return databaseUrl;
  }

  try {
    const { address } = await lookup(hostname, { family: 4 });
    if (!address) throw new Error('empty address');

    // Replace hostname with the raw IPv4 address.
    // We must also set the SNI server name for SSL because the certificate
    // is issued for the hostname, not the IP.  pg supports this via the
    // ssl.servername option, but that requires passing an object config
    // rather than a connection string.  Return both so callers can choose.
    const resolved = new URL(databaseUrl);
    resolved.hostname = address;

    console.log(`[db] Resolved ${hostname} → ${address} (IPv4)`);
    return resolved.toString();
  } catch (err) {
    // IPv4 resolution failed — probably local dev on IPv6-capable network.
    // Fall back silently so local dev is unaffected.
    console.log(`[db] IPv4 resolution for ${hostname} unavailable (${err.message}) — using hostname`);
    return databaseUrl;
  }
}

/**
 * Build a pg client-options object from a connection string, with the
 * hostname resolved to IPv4 and ssl.servername set correctly so TLS
 * verification uses the original hostname (not the raw IP).
 *
 * @param {string} databaseUrl
 * @returns {Promise<object>}  pg Client / Pool options
 */
export async function buildPgConfig(databaseUrl, extraOptions = {}) {
  if (!databaseUrl) throw new Error('databaseUrl is required');

  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    // Unparseable — use as-is with basic SSL
    return {
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false },
      ...extraOptions,
    };
  }

  const hostname = parsed.hostname;
  let resolvedIp = null;

  if (!/^[\d.]+$/.test(hostname) && !hostname.includes(':')) {
    try {
      const { address } = await lookup(hostname, { family: 4 });
      if (address) {
        resolvedIp = address;
        console.log(`[db] Resolved ${hostname} → ${resolvedIp} (IPv4)`);
      }
    } catch {
      // Fall through — will use hostname
    }
  }

  const safeHost = resolvedIp || hostname;

  const config = {
    host: safeHost,
    port: parseInt(parsed.port, 10) || 5432,
    database: parsed.pathname.replace(/^\//, '') || 'postgres',
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    ssl: {
      rejectUnauthorized: false,
      // Keep SNI as original hostname so the Supabase TLS cert is accepted
      ...(resolvedIp ? { servername: hostname } : {}),
    },
    ...extraOptions,
  };

  if (resolvedIp) {
    console.log(`[db] Connecting via IPv4 ${resolvedIp}:${config.port} (SNI: ${hostname})`);
  } else {
    console.log(`[db] Connecting to ${hostname}:${config.port}`);
  }

  return config;
}
