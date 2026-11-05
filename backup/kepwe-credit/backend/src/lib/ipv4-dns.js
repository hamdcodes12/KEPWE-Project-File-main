import dns from 'dns';

// Force IPv4 DNS resolution for Node.js
export function forceIPv4DNS() {
  // Set DNS resolution order to prefer IPv4
  if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
    console.log('[dns] Set DNS resolution order to IPv4 first');
  }
  
  // Alternative approach: override Node.js DNS lookup
  const originalLookup = dns.lookup;
  dns.lookup = function(hostname, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    
    // Force IPv4 family
    const modifiedOptions = {
      ...options,
      family: 4
    };
    
    return originalLookup.call(this, hostname, modifiedOptions, callback);
  };
  
  console.log('[dns] Overridden DNS lookup to force IPv4');
}

// Call this early in the application
forceIPv4DNS();