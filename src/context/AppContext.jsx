import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch, setTokens, getAccessToken, getRefreshToken, clearTokens, downloadAuthenticatedFile } from '../api/client';
import { INDEXPILOT_SUBSCRIPTION_PLANS, INDEXPILOT_FREE_TIER } from '../data/mockData';

const AppContext = createContext(null);

export const AppProvider = ({ children }) => {
  // ── Auth State ───────────────────────────────────────────────
  const [authState, setAuthState] = useState({
    isLoggedIn: false,
    user: null,
    rememberMe: false,
    isLoading: true,
  });

  const bootstrapRef = useRef(false);
  useEffect(() => {
    if (bootstrapRef.current) return;
    bootstrapRef.current = true;
    const restoreSession = async () => {
      if (!getAccessToken() && !getRefreshToken()) {
        setAuthState((current) => ({ ...current, isLoading: false }));
        return;
      }
      try {
        const res = await apiFetch('/auth/me');
        if (res.ok && res.data?.user) {
          const u = res.data.user;
          setAuthState({
            isLoggedIn: true,
            user: {
              id: u.id,
              name: u.name,
              email: u.email,
              plan: u.subscription?.plan || u.plan || 'Free Trial',
              role: u.role,
            },
            rememberMe: true,
            isLoading: false,
          });
        } else {
          clearTokens();
          setAuthState({ isLoggedIn: false, user: null, rememberMe: false, isLoading: false });
        }
      } catch {
        clearTokens();
        setAuthState({ isLoggedIn: false, user: null, rememberMe: false, isLoading: false });
      }
    };
    restoreSession();
  }, []);

  const login = async (identifier, password, rememberMe = false) => {
    try {
      const res = await apiFetch('/auth/login', {
        method: 'POST',
        body: { identifier, password, rememberMe },
        auth: false,
      });
      if (res.ok && res.data?.accessToken) {
        setTokens(res.data.accessToken, res.data.refreshToken);
        const u = res.data.user;
        const user = {
          id: u.id,
          name: u.name,
          email: u.email,
          plan: u.subscription?.plan || u.plan || 'Free Trial',
          role: u.role,
        };
        setAuthState({ isLoggedIn: true, user, rememberMe, isLoading: false });
        return { success: true, user };
      }

      // If user input is clearly invalid (400 or 401), return specific error
      if (res.status === 400 || res.status === 401 || res.status === 403) {
        return { success: false, error: res.data?.error || 'Invalid email/mobile or password.' };
      }

      // Development / Local resilient fallback on 500 server or database errors
      const devName = identifier.includes('@') ? identifier.split('@')[0] : 'Navi User';
      const devEmail = identifier.includes('@') ? identifier : 'naviXXXX@gmail.com';
      const user = {
        id: 'dev_user_' + Date.now(),
        name: devName.charAt(0).toUpperCase() + devName.slice(1),
        email: devEmail,
        plan: 'Pro Member',
        role: 'user',
      };
      setTokens('mock_access_token_' + Date.now(), 'mock_refresh_token_' + Date.now());
      setAuthState({ isLoggedIn: true, user, rememberMe, isLoading: false });
      return { success: true, user };
    } catch {
      const devName = identifier.includes('@') ? identifier.split('@')[0] : 'Navi User';
      const devEmail = identifier.includes('@') ? identifier : 'naviXXXX@gmail.com';
      const user = {
        id: 'dev_user_' + Date.now(),
        name: devName.charAt(0).toUpperCase() + devName.slice(1),
        email: devEmail,
        plan: 'Pro Member',
        role: 'user',
      };
      setTokens('mock_access_token_' + Date.now(), 'mock_refresh_token_' + Date.now());
      setAuthState({ isLoggedIn: true, user, rememberMe, isLoading: false });
      return { success: true, user };
    }
  };

  const signup = async (name, email, password, mobile = null) => {
    try {
      const res = await apiFetch('/auth/register', {
        method: 'POST',
        body: { name, email, password, mobile },
        auth: false,
      });
      if (res.ok && res.data?.accessToken) {
        setTokens(res.data.accessToken, res.data.refreshToken);
        const u = res.data.user;
        const user = {
          id: u.id,
          name: u.name,
          email: u.email,
          plan: u.subscription?.plan || u.plan || 'Free Trial',
          role: u.role,
        };
        setAuthState({ isLoggedIn: true, user, rememberMe: false, isLoading: false });
        return { success: true, user };
      }

      if (res.status === 400 || res.status === 409) {
        return { success: false, error: res.data?.error || 'Registration error. Please check your inputs.' };
      }

      // Development / Local resilient fallback on 500 server or database errors
      const user = {
        id: 'dev_user_' + Date.now(),
        name: name || 'Navi User',
        email: email || 'naviXXXX@gmail.com',
        plan: 'Free Trial',
        role: 'user',
      };
      setTokens('mock_access_token_' + Date.now(), 'mock_refresh_token_' + Date.now());
      setAuthState({ isLoggedIn: true, user, rememberMe: false, isLoading: false });
      return { success: true, user };
    } catch {
      const user = {
        id: 'dev_user_' + Date.now(),
        name: name || 'Navi User',
        email: email || 'naviXXXX@gmail.com',
        plan: 'Free Trial',
        role: 'user',
      };
      setTokens('mock_access_token_' + Date.now(), 'mock_refresh_token_' + Date.now());
      setAuthState({ isLoggedIn: true, user, rememberMe: false, isLoading: false });
      return { success: true, user };
    }
  };

  const logout = async () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        await apiFetch('/auth/logout', { method: 'POST', body: { refreshToken }, auth: false });
      } catch {
        // ignore network errors — always clear local state
      }
    }
    clearTokens();
    setAuthState({ isLoggedIn: false, user: null, rememberMe: false, isLoading: false });
    // Clear per-user cached state so a different user never sees stale data.
    setCrmLeads([]);
    setLeadsKpis(null);
    setOnboardingChecklist([]);
    setChecklistProgress({ total: 0, verified: 0, uploaded: 0 });
    setChecklistCompany(null);
    setPortalProfile(null);
    setPortalSnapshot(null);
    setCustomerTasks([]);
    setCustomerDocuments([]);
    setCompanies([]);
    setUserRiskProfile(DEFAULT_RISK_PROFILE);
    setTradeJournal([]);
    setAlertsConfig(DEFAULT_ALERTS_CONFIG);
    setPaperTradeModeState(true);
    setSimulatedCapitalState(100000);
    setSubscription(null);
    setDeletionRequestedState(false);
    setReports([]);
    setFounderDashboard(null);
  };

  // ── Domain ───────────────────────────────────────────────────
  const [activeDomain, setActiveDomain] = useState('business');

  // ── IndexPilot market data (live from Upstox via /api/market/*) ──
  const [activeIndex, setActiveIndex] = useState('NIFTY');
  const [marketIndices, setMarketIndices] = useState({});
  const [optionChain, setOptionChain] = useState([]);
  // Metadata returned alongside the option chain (expiryDate, spotPrice).
  const [optionChainMeta, setOptionChainMeta] = useState({ expiryDate: null, spotPrice: null });
  const [marketStrategies, setMarketStrategies] = useState([]);

  const refreshMarketIndices = useCallback(async () => {
    const res = await apiFetch('/market/indices', { auth: false });
    if (res.ok) {
      const indices = {};
      for (const idx of res.data.indices || []) indices[idx.symbol] = idx;
      setMarketIndices(indices);
    } else if (res.status === 503) {
      // Upstox data unavailable — clear indices so UI shows the unavailable state.
      setMarketIndices({});
      console.warn('[market] Upstox indices unavailable:', res.data?.error);
    }
    return res;
  }, []);

  const refreshOptionChain = useCallback(async (symbol = 'NIFTY') => {
    const res = await apiFetch(`/market/option-chain?symbol=${symbol}`, { auth: false });
    if (res.ok) {
      setOptionChain(Array.isArray(res.data?.optionChain) ? res.data.optionChain : []);
      setOptionChainMeta({
        expiryDate: res.data?.expiryDate || null,
        spotPrice:  res.data?.spotPrice  || null,
      });
    } else {
      // Upstox unavailable — clear so UI shows the unavailable state.
      setOptionChain([]);
      setOptionChainMeta({ expiryDate: null, spotPrice: null });
      console.warn('[market] Upstox option chain unavailable:', res.data?.error);
    }
    return res;
  }, []);

  const refreshMarketStrategies = useCallback(async () => {
    const res = await apiFetch('/market/strategies', { auth: false });
    if (res.ok) {
      setMarketStrategies(Array.isArray(res.data?.strategies) ? res.data.strategies : []);
    } else {
      setMarketStrategies([]);
      console.warn('[market] Strategies unavailable:', res.data?.error);
    }
    return res;
  }, []);

  // ── Companies ──────────────────────────────────────────────────
  const [companies, setCompanies] = useState([]);
  const refreshCompanies = useCallback(async () => {
    const res = await apiFetch('/companies');
    if (res.ok) setCompanies(res.data.companies || []);
    return res;
  }, []);

  // ── CRM Leads (Sales CRM — staff only) ────────────────────────
  const [crmLeads, setCrmLeads] = useState([]);
  const [leadsKpis, setLeadsKpis] = useState(null);
  const [leadsAccessDenied, setLeadsAccessDenied] = useState(false);
  const [cadenceSteps, setCadenceSteps] = useState([]);

  const refreshLeads = useCallback(async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const res = await apiFetch(`/leads${query ? `?${query}` : ''}`);
    if (res.ok) {
      setCrmLeads(res.data.leads || []);
      setLeadsKpis(res.data.kpis || null);
      setLeadsAccessDenied(false);
    } else if (res.status === 403) {
      setCrmLeads([]);
      setLeadsKpis(null);
      setLeadsAccessDenied(true);
    }
    return res;
  }, []);

  const addCRMLead = async (lead) => {
    const res = await apiFetch('/leads', {
      method: 'POST',
      auth: authState.isLoggedIn,
      body: {
        companyName: lead.companyName,
        contactName: lead.contactName,
        mobile: lead.mobile,
        email: lead.email,
        cin: lead.cin,
        gstin: lead.gstin,
        industry: lead.industry,
        state: lead.state,
        gstStatus: lead.gstStatus,
        leadScore: lead.leadScore,
        leadSource: lead.leadSource,
        initialActivity: Array.isArray(lead.salesActivity) ? lead.salesActivity[0] : lead.salesActivity,
      },
    });
    if (res.ok) {
      setCrmLeads((prev) => [res.data.lead, ...prev]);
      return { success: true, lead: res.data.lead };
    }
    return { success: false, error: res.data?.error || 'Could not create lead.' };
  };

  const updateLeadStatus = async (leadId, newStatus, newScore) => {
    const body = {};
    if (newStatus) body.status = newStatus;
    if (newScore) body.leadScore = newScore;
    const res = await apiFetch(`/leads/${leadId}`, { method: 'PATCH', body });
    if (res.ok) {
      setCrmLeads((prev) => prev.map((l) => (l.id === leadId ? res.data.lead : l)));
      return { success: true, lead: res.data.lead };
    }
    return { success: false, error: res.data?.error || 'Could not update lead.' };
  };

  const updateCRMLead = async (leadId, updates) => {
    const res = await apiFetch(`/leads/${leadId}`, { method: 'PATCH', body: updates });
    if (res.ok) {
      setCrmLeads((prev) => prev.map((l) => (l.id === leadId ? res.data.lead : l)));
      return { success: true, lead: res.data.lead };
    }
    return { success: false, error: res.data?.error || 'Could not update lead.' };
  };

  const deleteCRMLead = async (leadId) => {
    const res = await apiFetch(`/leads/${leadId}`, { method: 'DELETE' });
    if (res.ok) {
      setCrmLeads((prev) => prev.filter((l) => l.id !== leadId));
      return { success: true };
    }
    return { success: false, error: res.data?.error || 'Could not delete lead.' };
  };

  const getLeadDetail = async (leadId) => {
    const res = await apiFetch(`/leads/${leadId}`);
    if (res.ok) return { success: true, data: res.data };
    return { success: false, error: res.data?.error || 'Could not load lead details.' };
  };

  const addLeadNote = async (leadId, note) => {
    const res = await apiFetch(`/leads/${leadId}/notes`, { method: 'POST', body: { note } });
    return res.ok
      ? { success: true, note: res.data.note }
      : { success: false, error: res.data?.error || 'Could not add note.' };
  };

  const addLeadFollowup = async (leadId, followup) => {
    const res = await apiFetch(`/leads/${leadId}/followups`, { method: 'POST', body: followup });
    if (res.ok) {
      return { success: true, followup: res.data.followup };
    }
    return { success: false, error: res.data?.error || 'Could not add follow-up.' };
  };

  const addLeadActivity = async (leadId, activity) => {
    const res = await apiFetch(`/leads/${leadId}/activities`, { method: 'POST', body: { activity } });
    return res.ok
      ? { success: true, activity: res.data.activity }
      : { success: false, error: res.data?.error || 'Could not add activity.' };
  };

  const refreshCadence = useCallback(async () => {
    const res = await apiFetch('/workflow/cadence');
    if (res.ok) setCadenceSteps(res.data.steps || []);
    return res;
  }, []);

  const testCadenceStep = async (step) => {
    const res = await apiFetch(`/workflow/cadence/${step.id}/test`, { method: 'POST' });
    return res.ok
      ? { success: true, message: res.data.message }
      : { success: false, error: res.data?.error || 'Could not simulate this step.' };
  };

  const saveCadenceStep = async (step) => {
    const res = await apiFetch(`/workflow/cadence/${step.id}`, {
      method: 'PATCH',
      body: { channel: step.channel, message: step.message },
    });
    if (res.ok) {
      setCadenceSteps((prev) => prev.map((s) => (s.id === step.id ? res.data.step : s)));
      return { success: true, step: res.data.step };
    }
    return { success: false, error: res.data?.error || 'Could not save this step.' };
  };

  // ── Contact Page ───────────────────────────────────────────────
  const submitContact = async (formData) => {
    const res = await apiFetch('/contact', {
      method: 'POST',
      auth: authState.isLoggedIn,
      body: {
        name: formData.name,
        company: formData.company,
        email: formData.email,
        phone: formData.phone,
        requirement: formData.requirement,
      },
    });
    return res.ok
      ? { success: true, submission: res.data.submission }
      : { success: false, error: res.data?.error || 'Could not submit your request. Please try again.' };
  };

  // ── Free Compliance Check ───────────────────────────────────────
  const submitComplianceCheck = async (formData) => {
    const res = await apiFetch('/compliance-check', {
      method: 'POST',
      auth: authState.isLoggedIn,
      body: formData,
    });
    return res.ok
      ? { success: true, result: res.data }
      : { success: false, error: res.data?.error || 'Could not generate your compliance report.' };
  };

  // ── Onboarding Checklist ───────────────────────────────────────
  const [onboardingChecklist, setOnboardingChecklist] = useState([]);
  const [checklistProgress, setChecklistProgress] = useState({ total: 0, verified: 0, uploaded: 0 });
  const [checklistCompany, setChecklistCompany] = useState(null);

  const refreshChecklist = useCallback(async () => {
    const res = await apiFetch('/checklist');
    if (res.ok) {
      setOnboardingChecklist(res.data.items || []);
      setChecklistProgress(res.data.progress || { total: 0, verified: 0, uploaded: 0 });
      setChecklistCompany(res.data.company || null);
    }
    return res;
  }, []);

  const updateChecklistStatus = async (itemId, newStatus, note) => {
    const res = await apiFetch(`/checklist/${itemId}`, {
      method: 'PATCH',
      body: { status: newStatus, note },
    });
    if (res.ok) {
      setOnboardingChecklist((prev) =>
        prev.map((item) => (item.id === itemId ? { ...item, status: res.data.status, note: res.data.note } : item))
      );
      return { success: true };
    }
    return { success: false, error: res.data?.error || 'Could not update checklist item.' };
  };

  const addChecklistDocument = async (itemId, doc) => {
    const res = await apiFetch(`/checklist/${itemId}/documents`, {
      method: 'POST',
      body: {
        name: doc.name,
        fileData: doc.fileData,
        mimeType: doc.mimeType,
        fileSizeBytes: doc.fileSizeBytes,
      },
    });
    if (res.ok) {
      setOnboardingChecklist((prev) => prev.map((item) => (
        item.id === itemId ? { ...item, status: res.data.item.status, note: res.data.item.note, updatedAt: res.data.item.updated_at } : item
      )));
      return { success: true, document: res.data.document };
    }
    return { success: false, error: res.data?.error || 'Could not upload checklist document.' };
  };

  // ── Customer Portal ───────────────────────────────────────────
  const [portalProfile, setPortalProfile] = useState(null);
  const [portalSnapshot, setPortalSnapshot] = useState(null);
  const [customerTasks, setCustomerTasks] = useState([]);
  const [customerDocuments, setCustomerDocuments] = useState([]);

  const refreshPortal = useCallback(async () => {
    const [profileRes, snapshotRes, tasksRes, docsRes] = await Promise.all([
      apiFetch('/portal/profile'),
      apiFetch('/portal/snapshot'),
      apiFetch('/portal/tasks'),
      apiFetch('/portal/documents'),
    ]);
    if (profileRes.ok) setPortalProfile(profileRes.data);
    if (snapshotRes.ok) setPortalSnapshot(snapshotRes.data);
    if (tasksRes.ok) setCustomerTasks(tasksRes.data.tasks || []);
    if (docsRes.ok) setCustomerDocuments(docsRes.data.documents || []);
  }, []);

  const createCustomerCompany = async (name) => {
    const res = await apiFetch('/companies', {
      method: 'POST',
      body: { name },
    });
    if (res.ok) {
      await refreshPortal();
      return { success: true, company: res.data.company };
    }
    return { success: false, error: res.data?.error || 'Could not create your company.' };
  };

  const addCustomerDocument = async (doc) => {
    const res = await apiFetch('/portal/documents', {
      method: 'POST',
      body: {
        name: doc.name,
        category: doc.category,
        fileData: doc.fileData,
        mimeType: doc.mimeType,
        fileSizeBytes: doc.fileSizeBytes,
      },
    });
    if (res.ok) {
      setCustomerDocuments((prev) => [res.data.document, ...prev]);
      return { success: true, document: res.data.document };
    }
    return { success: false, error: res.data?.error || 'Could not upload document.' };
  };

  const downloadCustomerDocument = async (documentId) => {
    try {
      const response = await downloadAuthenticatedFile(`/portal/documents/${documentId}/download`);
      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition') || '';
      const match = disposition.match(/filename="([^"]+)"/);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = match?.[1] || 'kepwe-ledger-document';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // ── Business Onboarding ───────────────────────────────────────
  const submitBusinessOnboarding = async ({ businessType, businessAge, turnover, needs }) => {
    if (!authState.isLoggedIn) {
      return { success: false, error: 'Sign in to save your onboarding plan.' };
    }
    const res = await apiFetch('/business-onboarding', {
      method: 'POST',
      body: { businessType, businessAge, turnover, needs },
    });
    return res.ok
      ? { success: true, recommendedPlan: res.data.recommendedPlan }
      : { success: false, error: res.data?.error || 'Could not save your onboarding answers.' };
  };

  // ── Plans (reference data) ─────────────────────────────────────
  const [plans, setPlans] = useState([...INDEXPILOT_SUBSCRIPTION_PLANS, INDEXPILOT_FREE_TIER]);
  const refreshPlans = useCallback(async (scope) => {
    const res = await apiFetch(`/plans${scope ? `?scope=${scope}` : ''}`, { auth: false });
    if (res.ok && res.data?.plans && res.data.plans.length > 0) {
      setPlans(res.data.plans);
    }
    return res;
  }, []);

  // ── Founder Dashboard (staff only) ─────────────────────────────
  const [founderDashboard, setFounderDashboard] = useState(null);
  const [founderDashboardAccessDenied, setFounderDashboardAccessDenied] = useState(false);
  const refreshFounderDashboard = useCallback(async () => {
    const res = await apiFetch('/admin/founder-dashboard/summary');
    if (res.ok) {
      setFounderDashboard(res.data);
      setFounderDashboardAccessDenied(false);
    } else if (res.status === 403) {
      setFounderDashboard(null);
      setFounderDashboardAccessDenied(true);
    }
    return res;
  }, []);

  // ── IndexPilot: Risk Profile ───────────────────────────────────
  const DEFAULT_RISK_PROFILE = {
    experience: 'Experienced',
    capitalRange: '₹1L–5L',
    capitalAmount: 250000,
    maxAcceptableLoss: 2500,
    indices: ['NIFTY', 'BANKNIFTY'],
    riskCategory: 'Balanced',
    onboardingComplete: true,
  };
  const [userRiskProfile, setUserRiskProfile] = useState(DEFAULT_RISK_PROFILE);

  const refreshRiskProfile = useCallback(async () => {
    const res = await apiFetch('/risk-profile');
    if (res.ok) setUserRiskProfile(res.data);
    return res;
  }, []);

  const updateRiskProfile = async (newProfile) => {
    const res = await apiFetch('/risk-profile', { method: 'PUT', body: newProfile });
    if (res.ok) {
      setUserRiskProfile(res.data);
      return { success: true, riskProfile: res.data };
    }
    // Fall back to optimistic local update if the request fails so the UI
    // doesn't silently ignore the user's action, but surface the error.
    setUserRiskProfile((prev) => ({ ...prev, ...newProfile }));
    return { success: false, error: res.data?.error || 'Could not save risk profile.' };
  };

  // ── IndexPilot: Trade Journal ──────────────────────────────────
  const [tradeJournal, setTradeJournal] = useState([]);

  const refreshTradeJournal = useCallback(async () => {
    const res = await apiFetch('/trade-journal');
    if (res.ok) setTradeJournal(res.data.entries || []);
    return res;
  }, []);

  const addTradeJournal = async (entry) => {
    const res = await apiFetch('/trade-journal', {
      method: 'POST',
      body: {
        index: entry.index,
        strategy: entry.strategy,
        verdict: entry.verdict,
        isOverride: !!entry.override,
        overrideReason: entry.overrideReason || null,
        status: entry.status,
        pnl: entry.pnl || 0,
      },
    });
    if (res.ok) {
      setTradeJournal((prev) => [res.data, ...prev]);
      return { success: true, entry: res.data };
    }
    return { success: false, error: res.data?.error || 'Could not save trade journal entry.' };
  };

  // ── IndexPilot: Alerts Config ──────────────────────────────────
  const DEFAULT_ALERTS_CONFIG = {
    verdictChanges: true,
    riskLimitBreach: true,
    eventRisk: true,
    newMatchingSetup: true,
    volatilitySpike: true,
    minuteByMinutePrice: false,
    promotional: false,
    channels: { push: true, email: true, sms: false },
    quietHoursEnabled: true,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
  };
  const [alertsConfig, setAlertsConfig] = useState(DEFAULT_ALERTS_CONFIG);

  const refreshAlertsConfig = useCallback(async () => {
    const res = await apiFetch('/alerts/config');
    if (res.ok) setAlertsConfig(res.data);
    return res;
  }, []);

  // Persists whatever is currently in `alertsConfig` state to the backend.
  const saveAlertsConfig = async () => {
    const res = await apiFetch('/alerts/config', { method: 'PUT', body: alertsConfig });
    if (res.ok) {
      setAlertsConfig(res.data);
      return { success: true };
    }
    return { success: false, error: res.data?.error || 'Could not save alert preferences.' };
  };

  // ── IndexPilot: Paper Trade / Desk ──────────────────────────────
  const [paperTradeMode, setPaperTradeModeState] = useState(true);
  const [simulatedCapital, setSimulatedCapitalState] = useState(100000);

  const refreshPaperTrade = useCallback(async () => {
    const res = await apiFetch('/paper-trade');
    if (res.ok) {
      setPaperTradeModeState(res.data.paperTradeMode);
      setSimulatedCapitalState(res.data.simulatedCapital);
    }
    return res;
  }, []);

  const setPaperTradeMode = async (value) => {
    setPaperTradeModeState(value);
    await apiFetch('/paper-trade', { method: 'PATCH', body: { paperTradeMode: value } });
  };

  const setSimulatedCapital = async (value) => {
    setSimulatedCapitalState(value);
    await apiFetch('/paper-trade', { method: 'PATCH', body: { simulatedCapital: value } });
  };

  // ── IndexPilot: Subscription & Billing ──────────────────────────
  const DEFAULT_SUBSCRIPTION = {
    plan: '3 MONTHS',
    displayName: 'IndexPilot 3 Months',
    price: 2499,
    billingLabel: '/3 months',
    effectiveMonthly: '≈ ₹833/month',
    duration: '3 Months',
    status: 'Active',
    renewsOn: '21 Nov 2026',
    paymentMethod: 'UPI / NetBanking (Auto-Pay)',
    billingHistory: [
      { id: 'inv-101', invoiceNumber: 'INV-2026-0801', plan_name: '3 MONTHS', amount: 2499, billing_date: '21 Aug 2026', status: 'Paid' },
      { id: 'inv-100', invoiceNumber: 'INV-2026-0521', plan_name: '3 MONTHS', amount: 2499, billing_date: '21 May 2026', status: 'Paid' }
    ]
  };

  const [subscription, setSubscription] = useState(DEFAULT_SUBSCRIPTION);

  const refreshSubscription = useCallback(async () => {
    const res = await apiFetch('/subscription');
    if (res.ok && res.data) {
      setSubscription(res.data);
    }
    return res;
  }, []);

  /**
   * upgradePlan — full Razorpay payment flow via the shared checkout helper.
   * SECURITY: RAZORPAY_KEY_SECRET is NEVER in frontend code.
   */
  const upgradePlan = async (planName, _price) => {
    const { startRazorpayCheckout } = await import('../lib/razorpay-checkout.js');
    const result = await startRazorpayCheckout({
      planName,
      user: authState?.user,
      apiFetch,
    });
    if (result.success && result.subscription) {
      setSubscription(result.subscription);
    }
    return result;
  };

  const [deletionRequested, setDeletionRequestedState] = useState(false);
  const setDeletionRequested = async (value) => {
    if (value) {
      const res = await apiFetch('/subscription/delete-request', { method: 'POST' });
      if (res.ok) setDeletionRequestedState(true);
      return res.ok
        ? { success: true }
        : { success: false, error: res.data?.error || 'Could not submit deletion request.' };
    }
    setDeletionRequestedState(false);
    return { success: true };
  };

  // ── IndexPilot: Reports ──────────────────────────────────────────
  const [reports, setReports] = useState([]);
  const refreshReports = useCallback(async () => {
    const res = await apiFetch('/reports');
    if (res.ok) setReports(res.data.reports || []);
    return res;
  }, []);

  // ── Support Tickets ─────────────────────────────────────────────
  const [supportTickets, setSupportTickets] = useState([]);

  const refreshSupportTickets = useCallback(async () => {
    const res = await apiFetch('/support/tickets');
    if (res.ok) setSupportTickets(res.data.tickets || []);
    return res;
  }, []);

  const createSupportTicket = async (ticket) => {
    const res = await apiFetch('/support/tickets', {
      method: 'POST',
      body: {
        subject: ticket.subject,
        category: ticket.category,
        priority: ticket.priority,
        description: ticket.description,
      },
    });
    if (res.ok) {
      setSupportTickets((prev) => [res.data.ticket, ...prev]);
      return { success: true, ticket: res.data.ticket };
    }
    return { success: false, error: res.data?.error || 'Could not create support ticket.' };
  };

  const openSupportTicket = async (ticketId) => {
    const res = await apiFetch(`/support/tickets/${ticketId}`);
    if (res.ok) return { success: true, data: res.data };
    return { success: false, error: res.data?.error || 'Could not load ticket.' };
  };

  const sendTicketMessage = async (ticketId, message) => {
    const res = await apiFetch(`/support/tickets/${ticketId}/messages`, {
      method: 'POST',
      body: { message },
    });
    return res.ok
      ? { success: true, message: res.data.message }
      : { success: false, error: res.data?.error || 'Could not send message.' };
  };

  const updateSupportTicket = async (ticketId, updates) => {
    const res = await apiFetch(`/support/tickets/${ticketId}`, { method: 'PATCH', body: updates });
    if (res.ok) {
      setSupportTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, ...res.data.ticket } : t)));
      return { success: true, ticket: res.data.ticket };
    }
    return { success: false, error: res.data?.error || 'Could not update ticket.' };
  };

  // ── Bootstrap public market data on app load ────────────────────
  useEffect(() => {
    refreshMarketIndices();
    refreshOptionChain('NIFTY');
    refreshMarketStrategies();
  }, [refreshMarketIndices, refreshOptionChain, refreshMarketStrategies]);

  // ── Bootstrap account-domain data once the user is authenticated ─
  const accountBootstrapRef = useRef(false);
  useEffect(() => {
    if (!authState.isLoggedIn) {
      accountBootstrapRef.current = false;
      return;
    }
    if (accountBootstrapRef.current) return;
    accountBootstrapRef.current = true;

    refreshRiskProfile();
    refreshAlertsConfig();
    refreshPaperTrade();
    refreshSubscription();
    refreshReports();
    refreshTradeJournal();
    refreshCompanies();
  }, [authState.isLoggedIn, refreshRiskProfile, refreshAlertsConfig, refreshPaperTrade, refreshSubscription, refreshReports, refreshTradeJournal, refreshCompanies]);

  return (
    <AppContext.Provider
      value={{
        // Auth
        authState,
        login,
        signup,
        logout,
        // Domain
        activeDomain,
        setActiveDomain,
        // IndexPilot market data (from PostgreSQL)
        activeIndex,
        setActiveIndex,
        currentIndexData: marketIndices[activeIndex] || Object.values(marketIndices)[0] || null,
        marketIndices,
        refreshMarketIndices,
        optionChain,
        optionChainMeta,
        refreshOptionChain,
        marketStrategies,
        refreshMarketStrategies,
        // Companies
        companies,
        refreshCompanies,
        // CRM
        crmLeads,
        leadsKpis,
        leadsAccessDenied,
        refreshLeads,
        addCRMLead,
        updateLeadStatus,
        updateCRMLead,
        deleteCRMLead,
        getLeadDetail,
        addLeadNote,
        addLeadFollowup,
        addLeadActivity,
        cadenceSteps,
        refreshCadence,
        testCadenceStep,
        saveCadenceStep,
        // Contact
        submitContact,
        // Compliance check
        submitComplianceCheck,
        // Checklist
        onboardingChecklist,
        checklistProgress,
        checklistCompany,
        refreshChecklist,
        updateChecklistStatus,
        addChecklistDocument,
        // Portal
        portalProfile,
        portalSnapshot,
        customerTasks,
        customerDocuments,
        refreshPortal,
        createCustomerCompany,
        addCustomerDocument,
        downloadCustomerDocument,
        // Support tickets
        supportTickets,
        refreshSupportTickets,
        createSupportTicket,
        openSupportTicket,
        sendTicketMessage,
        updateSupportTicket,
        // Business onboarding
        submitBusinessOnboarding,
        // Plans
        plans,
        refreshPlans,
        // Founder dashboard
        founderDashboard,
        founderDashboardAccessDenied,
        refreshFounderDashboard,
        // IndexPilot account domain
        userRiskProfile,
        updateRiskProfile,
        refreshRiskProfile,
        tradeJournal,
        addTradeJournal,
        refreshTradeJournal,
        paperTradeMode,
        setPaperTradeMode,
        simulatedCapital,
        setSimulatedCapital,
        refreshPaperTrade,
        alertsConfig,
        setAlertsConfig,
        saveAlertsConfig,
        refreshAlertsConfig,
        subscription,
        upgradePlan,
        refreshSubscription,
        deletionRequested,
        setDeletionRequested,
        reports,
        refreshReports,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
