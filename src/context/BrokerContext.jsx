import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { fetchDhanBrokerStatus, fetchBrokerStatus } from '../api/quantClient';

const BrokerContext = createContext(null);

const INITIAL_STATE = {
  status: 'LOADING', // 'LOADING' | 'CONNECTED' | 'DISCONNECTED' | 'DHAN_SESSION_EXPIRED' | 'ERROR'
  broker: 'DHAN',
  executionMode: 'LIVE',
  clientId: null,
  sessionValid: false,
  connectedAt: null,
  lastChecked: null,
  error: null,
};

export function BrokerProvider({ children }) {
  const [brokerState, setBrokerState] = useState(INITIAL_STATE);
  const requestIdRef = useRef(0);
  const activeFetchPromiseRef = useRef(null);
  const isMountedRef = useRef(true);

  const refreshBrokerState = useCallback(async (options = {}) => {
    const { force = false } = options;

    // If an identical request is currently in-flight and not forced, reuse it
    if (activeFetchPromiseRef.current && !force) {
      return activeFetchPromiseRef.current;
    }

    const currentRequestId = ++requestIdRef.current;

    const fetchPromise = (async () => {
      try {
        // Try specialized single-broker status endpoint first
        let res = await fetchDhanBrokerStatus();

        // Fallback to /api/broker/status if not available
        if (!res.ok && res.status === 404) {
          res = await fetchBrokerStatus();
          if (res.ok && res.data) {
            const dhan = res.data.dhan || res.data.brokers?.find((b) => b.broker === 'DHAN');
            if (dhan) {
              res = {
                ok: true,
                status: 200,
                data: {
                  connected: dhan.status === 'CONNECTED',
                  broker: 'DHAN',
                  status: dhan.status,
                  executionMode: dhan.mode || dhan.executionMode || 'LIVE',
                  clientId: dhan.clientId || null,
                  sessionValid: dhan.status === 'CONNECTED',
                  connectedAt: dhan.connectedAt || null,
                },
              };
            }
          }
        }

        // Stale check: Discard response if a newer request was dispatched
        if (!isMountedRef.current || currentRequestId !== requestIdRef.current) {
          return;
        }

        if (res.ok && res.data) {
          const data = res.data;
          const isConnected = data.connected === true && data.status === 'CONNECTED';
          const isExpired = data.status === 'DHAN_SESSION_EXPIRED' || data.status === 'SESSION_EXPIRED';
          const nextStatus = isConnected ? 'CONNECTED' : (isExpired ? 'DHAN_SESSION_EXPIRED' : 'DISCONNECTED');

          setBrokerState({
            status: nextStatus,
            broker: 'DHAN',
            executionMode: data.executionMode || 'LIVE',
            clientId: data.clientId || null,
            sessionValid: isConnected,
            connectedAt: data.connectedAt || null,
            lastChecked: Date.now(),
            error: null,
          });
        } else if (res.status === 401 && (res.data?.code === 'DHAN_SESSION_EXPIRED' || res.data?.broker === 'DHAN')) {
          setBrokerState((prev) => ({
            ...prev,
            status: 'DHAN_SESSION_EXPIRED',
            sessionValid: false,
            lastChecked: Date.now(),
            error: res.data?.error || 'Dhan session has expired. Please reconnect.',
          }));
        } else {
          // If request failed (e.g. 500 or network), only set ERROR if we don't have an active connected state
          // Never change CONNECTED to DISCONNECTED on transient network or 500 error!
          setBrokerState((prev) => {
            if (prev.status === 'CONNECTED') {
              console.warn('[BrokerContext] Status refresh transient failure; maintaining CONNECTED state.');
              return { ...prev, lastChecked: Date.now() };
            }
            return {
              ...prev,
              status: prev.status === 'LOADING' ? 'DISCONNECTED' : prev.status,
              sessionValid: false,
              lastChecked: Date.now(),
              error: res.data?.error || 'Unable to verify broker status',
            };
          });
        }
      } catch (err) {
        if (!isMountedRef.current || currentRequestId !== requestIdRef.current) {
          return;
        }
        setBrokerState((prev) => {
          if (prev.status === 'CONNECTED') {
            console.warn('[BrokerContext] Status refresh network error; maintaining CONNECTED state.');
            return { ...prev, lastChecked: Date.now() };
          }
          return {
            ...prev,
            status: prev.status === 'LOADING' ? 'DISCONNECTED' : prev.status,
            sessionValid: false,
            lastChecked: Date.now(),
            error: err.message || 'Network error verifying broker connection',
          };
        });
      } finally {
        if (currentRequestId === requestIdRef.current) {
          activeFetchPromiseRef.current = null;
        }
      }
    })();

    activeFetchPromiseRef.current = fetchPromise;
    return fetchPromise;
  }, []);

  // Initial load and visibility/polling lifecycle
  useEffect(() => {
    isMountedRef.current = true;
    refreshBrokerState();

    // 45-second polling interval (only runs when tab is visible)
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshBrokerState();
      }
    }, 45000);

    // Refresh immediately when tab returns to visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshBrokerState();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMountedRef.current = false;
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshBrokerState]);

  const isBrokerConnected = brokerState.status === 'CONNECTED' && brokerState.sessionValid;
  const isDhanConnected = brokerState?.status === 'CONNECTED' && brokerState?.sessionValid === true;

  const dhanStatus = {
    broker: 'DHAN',
    status: brokerState.status,
    clientId: brokerState.clientId,
    mode: brokerState.executionMode,
    connected: isBrokerConnected,
    sessionValid: brokerState.sessionValid,
    connectedAt: brokerState.connectedAt,
    lastChecked: brokerState.lastChecked,
    error: brokerState.error,
  };

  const value = {
    brokerState,
    dhanStatus,
    isBrokerConnected,
    isDhanConnected,
    sessionValid: brokerState.sessionValid,
    refreshBrokerState,
  };

  return (
    <BrokerContext.Provider value={value}>
      {children}
    </BrokerContext.Provider>
  );
}

export function useBroker() {
  const context = useContext(BrokerContext);
  if (!context) {
    throw new Error('useBroker must be used within a BrokerProvider');
  }
  return context;
}
