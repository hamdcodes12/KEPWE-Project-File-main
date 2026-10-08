import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { fetchAngelOneStatus } from '../api/quantClient';

// Angel One SmartAPI is the only supported broker for KEPWE Quant.
export const BROKER = 'ANGEL_ONE';
export const BROKER_NAME = 'Angel One';

const BrokerContext = createContext(null);

const INITIAL_STATE = {
  status: 'LOADING', // 'LOADING' | 'CONNECTED' | 'DISCONNECTED' | 'SESSION_EXPIRED' | 'ERROR'
  broker: BROKER,
  brokerName: BROKER_NAME,
  executionMode: 'LIVE',
  clientId: null,
  clientName: null,
  sessionValid: false,
  connectedAt: null,
  tokenExpiresAt: null,
  lastChecked: null,
  error: null,
};

const isExpiredStatus = (status) => status === 'ANGEL_ONE_SESSION_EXPIRED' || status === 'SESSION_EXPIRED';

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
        // The backend confirms the stored session with Angel One (getProfile) on every check.
        const res = await fetchAngelOneStatus();

        // Stale check: Discard response if a newer request was dispatched
        if (!isMountedRef.current || currentRequestId !== requestIdRef.current) {
          return;
        }

        if (res.ok && res.data) {
          const data = res.data;
          const isConnected = data.connected === true && data.status === 'CONNECTED';
          const nextStatus = isConnected ? 'CONNECTED' : (isExpiredStatus(data.status) ? 'SESSION_EXPIRED' : 'DISCONNECTED');

          setBrokerState({
            status: nextStatus,
            broker: BROKER,
            brokerName: BROKER_NAME,
            executionMode: data.executionMode || 'LIVE',
            clientId: data.clientId || null,
            clientName: data.clientName || null,
            sessionValid: isConnected,
            connectedAt: data.connectedAt || null,
            tokenExpiresAt: data.tokenExpiresAt || null,
            lastChecked: Date.now(),
            error: isConnected ? null : (data.lastError || null),
          });
        } else if (res.status === 401 && (res.data?.code === 'ANGEL_ONE_SESSION_EXPIRED' || res.data?.broker === BROKER)) {
          setBrokerState((prev) => ({
            ...prev,
            status: 'SESSION_EXPIRED',
            sessionValid: false,
            lastChecked: Date.now(),
            error: res.data?.error || 'Angel One session has expired. Please reconnect.',
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
  const isSessionExpired = brokerState.status === 'SESSION_EXPIRED';

  const brokerStatus = {
    broker: BROKER,
    brokerName: BROKER_NAME,
    status: brokerState.status,
    clientId: brokerState.clientId,
    clientName: brokerState.clientName,
    mode: brokerState.executionMode,
    connected: isBrokerConnected,
    sessionValid: brokerState.sessionValid,
    connectedAt: brokerState.connectedAt,
    tokenExpiresAt: brokerState.tokenExpiresAt,
    lastChecked: brokerState.lastChecked,
    error: brokerState.error,
  };

  const value = {
    brokerState,
    brokerStatus,
    isBrokerConnected,
    isSessionExpired,
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
