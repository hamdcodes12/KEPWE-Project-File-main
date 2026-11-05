import crypto from 'crypto';

/**
 * BaseProviderAdapter
 * Standard abstract base class for all government & third-party provider integrations
 * (NIC E-Invoice, E-Way Bill, GST GSP, NSDL TDS, Account Aggregator, etc.)
 */
export class BaseProviderAdapter {
  constructor(providerKey, providerName, options = {}) {
    this.providerKey = providerKey;
    this.providerName = providerName;
    this.environment = options.environment || process.env[`${providerKey}_ENV`] || 'sandbox';
    this.baseUrl = options.baseUrl || process.env[`${providerKey}_BASE_URL`] || '';
    this.clientId = options.clientId || process.env[`${providerKey}_CLIENT_ID`] || '';
    this.clientSecret = options.clientSecret || process.env[`${providerKey}_CLIENT_SECRET`] || '';
    this.username = options.username || process.env[`${providerKey}_USERNAME`] || '';
    this.password = options.password || process.env[`${providerKey}_PASSWORD`] || '';
    this.timeoutMs = options.timeoutMs || Number(process.env[`${providerKey}_TIMEOUT_MS`]) || 10000;
    this.maxRetries = options.maxRetries || 3;
    this.authToken = null;
    this.tokenExpiresAt = null;
  }

  /**
   * Checks if required credentials are provided in the environment/secrets store
   */
  hasCredentials() {
    return Boolean(this.clientId && this.clientSecret);
  }

  /**
   * Standard response contract when provider credentials are missing
   */
  credentialsRequiredResponse(action, details = {}) {
    return {
      success: false,
      status: 'CREDENTIALS_REQUIRED',
      providerKey: this.providerKey,
      providerName: this.providerName,
      action,
      message: `${this.providerName} credentials required for action "${action}". Configure environment variables.`,
      ...details
    };
  }

  /**
   * Executes an action with exponential retry
   */
  async executeWithRetry(action, fn) {
    let attempt = 0;
    let lastError = null;
    while (attempt < this.maxRetries) {
      attempt++;
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        if (attempt < this.maxRetries) {
          await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 200));
        }
      }
    }
    throw lastError;
  }

  async healthCheck() {
    if (!this.hasCredentials()) {
      return {
        providerKey: this.providerKey,
        providerName: this.providerName,
        connected: false,
        status: 'CREDENTIALS_REQUIRED',
        environment: this.environment,
        message: `Provider credentials required. Set ${this.providerKey}_CLIENT_ID and ${this.providerKey}_CLIENT_SECRET in backend environment variables.`,
        requiredEnvVars: [
          `${this.providerKey}_CLIENT_ID`,
          `${this.providerKey}_CLIENT_SECRET`,
          `${this.providerKey}_USERNAME`,
          `${this.providerKey}_PASSWORD`,
          `${this.providerKey}_ENV`
        ]
      };
    }

    try {
      await this.authenticate();
      return {
        providerKey: this.providerKey,
        providerName: this.providerName,
        connected: true,
        status: 'CONNECTED',
        environment: this.environment,
        message: `Successfully connected to ${this.providerName} (${this.environment}).`,
        tokenValid: Boolean(this.authToken)
      };
    } catch (err) {
      return {
        providerKey: this.providerKey,
        providerName: this.providerName,
        connected: false,
        status: 'AUTH_FAILED',
        environment: this.environment,
        message: err.message
      };
    }
  }

  /**
   * Authenticates with the provider (or throws CredentialRequiredError)
   */
  async authenticate() {
    if (!this.hasCredentials()) {
      throw new Error(`Cannot authenticate with ${this.providerName}: credentials not configured. Please supply ${this.providerKey}_CLIENT_ID.`);
    }

    // When real credentials exist:
    const response = await this.send('/authenticate', 'POST', {
      clientId: this.clientId,
      username: this.username,
      password: this.password
    });

    this.authToken = response.token;
    this.tokenExpiresAt = Date.now() + (response.expiresInSeconds || 3600) * 1000;
    return response;
  }

  /**
   * Refreshes auth token if expired
   */
  async ensureAuthenticated() {
    if (!this.authToken || (this.tokenExpiresAt && Date.now() >= this.tokenExpiresAt - 60000)) {
      await this.authenticate();
    }
  }

  /**
   * Mask sensitive attributes from logs to prevent secret leaks
   */
  maskPayload(payload) {
    if (!payload || typeof payload !== 'object') return payload;
    const masked = { ...payload };
    const sensitiveKeys = ['password', 'clientSecret', 'token', 'auth_token', 'app_secret', 'secretKey'];
    for (const key of Object.keys(masked)) {
      if (sensitiveKeys.some((s) => key.toLowerCase().includes(s.toLowerCase()))) {
        masked[key] = '********[PROTECTED]';
      } else if (typeof masked[key] === 'object') {
        masked[key] = this.maskPayload(masked[key]);
      }
    }
    return masked;
  }

  /**
   * Provider-agnostic HTTP request dispatcher with retry and timeout
   */
  async send(endpoint, method = 'POST', data = null, headers = {}) {
    if (!this.hasCredentials()) {
      const err = new Error(`${this.providerName} is not connected. Credentials are required in environment configuration.`);
      err.statusCode = 412; // Precondition Failed
      err.code = 'PROVIDER_CREDENTIALS_REQUIRED';
      throw err;
    }

    const requestId = crypto.randomUUID();
    const url = `${this.baseUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;
    const startTime = Date.now();

    const requestHeaders = {
      'Content-Type': 'application/json',
      'X-Request-Id': requestId,
      ...headers
    };
    if (this.authToken) {
      requestHeaders['Authorization'] = `Bearer ${this.authToken}`;
    }

    let attempt = 0;
    let lastError = null;

    while (attempt < this.maxRetries) {
      attempt++;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(url, {
          method,
          headers: requestHeaders,
          body: data ? JSON.stringify(data) : undefined,
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        const latency = Date.now() - startTime;
        const responseData = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(responseData.message || `Provider responded with status ${response.status}`);
        }

        return responseData;
      } catch (err) {
        lastError = err;
        if (attempt < this.maxRetries && method === 'GET') {
          await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 500));
        } else {
          break;
        }
      }
    }

    throw lastError;
  }
}
