import React, { useState, useEffect, useCallback } from 'react';
import { 
  Link2, 
  Check, 
  AlertTriangle, 
  RefreshCw, 
  ChevronRight, 
  X, 
  ShieldCheck,
  Activity,
  TrendingUp,
  Clock,
  Zap
} from 'lucide-react';
import './MultiBrokerManager.css';

/**
 * Enhanced Multi-Broker Management Component
 * Production-grade broker switching and management UI
 */
const MultiBrokerManager = () => {
  const [brokers, setBrokers] = useState([]);
  const [activeBroker, setActiveBroker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [refreshing, setRefreshing] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Load all broker connections
  const loadBrokerConnections = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/broker/connections', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kepwe_access_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load broker connections');
      }

      const data = await response.json();
      setBrokers(data.brokers || []);
      setActiveBroker(data.activeBroker);
    } catch (err) {
      setError(err.message || 'Failed to load broker connections');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBrokerConnections();
  }, [loadBrokerConnections]);

  // Set active broker
  const handleSetActiveBroker = async (broker) => {
    setSwitching(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/broker/set-active', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('kepwe_access_token')}`,
        },
        body: JSON.stringify({ broker }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to set active broker');
      }

      setSuccess(`${broker} is now your active broker`);
      await loadBrokerConnections();
    } catch (err) {
      setError(err.message || 'Failed to set active broker');
    } finally {
      setSwitching(false);
    }
  };

  // Refresh broker data
  const handleRefreshBrokerData = async (broker) => {
    setRefreshing(prev => ({ ...prev, [broker]: true }));
    setError('');

    try {
      const response = await fetch('/api/broker/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('kepwe_access_token')}`,
        },
        body: JSON.stringify({
          broker,
          dataTypes: ['funds', 'positions', 'holdings', 'orders', 'trades'],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to refresh broker data');
      }

      setSuccess(`${broker} data refreshed successfully`);
      await loadBrokerConnections();
    } catch (err) {
      setError(err.message || 'Failed to refresh broker data');
    } finally {
      setRefreshing(prev => ({ ...prev, [broker]: false }));
    }
  };

  // Trigger manual verification
  const handleVerifyBroker = async (broker) => {
    setRefreshing(prev => ({ ...prev, [`${broker}_verify`]: true }));
    setError('');

    try {
      const response = await fetch(`/api/broker/${broker}/verify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kepwe_access_token')}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Verification failed');
      }

      setSuccess(`${broker} verification complete: ${data.verification.score}% (${data.verification.status})`);
      await loadBrokerConnections();
    } catch (err) {
      setError(err.message || 'Verification failed');
    } finally {
      setRefreshing(prev => ({ ...prev, [`${broker}_verify`]: false }));
    }
  };

  // Get broker color
  const getBrokerColor = (broker) => {
    switch (broker) {
      case 'DHAN':
        return '#075056';
      case 'ANGEL_ONE':
        return '#C8102E';
      default:
        return '#64748b';
    }
  };

  // Get broker logo
  const getBrokerLogo = (broker) => {
    switch (broker) {
      case 'DHAN':
        return 'D';
      case 'ANGEL_ONE':
        return 'A';
      default:
        return broker.charAt(0);
    }
  };

  // Get status badge
  const getStatusBadge = (status) => {
    const badges = {
      CONNECTED: { label: 'Connected', color: '#10b981', icon: Check },
      PARTIALLY_CONNECTED: { label: 'Partial', color: '#f59e0b', icon: AlertTriangle },
      SESSION_EXPIRED: { label: 'Expired', color: '#ef4444', icon: Clock },
      NOT_CONNECTED: { label: 'Disconnected', color: '#64748b', icon: X },
      VERIFICATION_FAILED: { label: 'Failed', color: '#ef4444', icon: X },
      CONNECTION_FAILED: { label: 'Failed', color: '#ef4444', icon: X },
    };

    const badge = badges[status] || badges.NOT_CONNECTED;
    const Icon = badge.icon;

    return (
      <span 
        className="broker-status-badge" 
        style={{ 
          background: `${badge.color}20`,
          color: badge.color,
          border: `1px solid ${badge.color}40`
        }}
      >
        <Icon size={12} />
        {badge.label}
      </span>
    );
  };

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="multi-broker-manager">
        <div className="broker-manager-loading">
          <RefreshCw size={24} className="spin" />
          <p>Loading broker connections...</p>
        </div>
      </div>
    );
  }

  const connectedBrokers = brokers.filter(b => b.status === 'CONNECTED');
  const hasMultipleBrokers = connectedBrokers.length > 1;

  return (
    <div className="multi-broker-manager">
      {/* Header */}
      <div className="broker-manager-header">
        <div>
          <h2>Multi-Broker Management</h2>
          <p>Manage your connected broker accounts and switch between them</p>
        </div>
        <button 
          className="refresh-all-button" 
          onClick={loadBrokerConnections}
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          Refresh All
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="broker-alert error">
          <AlertTriangle size={16} />
          {error}
          <button onClick={() => setError('')}><X size={14} /></button>
        </div>
      )}

      {success && (
        <div className="broker-alert success">
          <Check size={16} />
          {success}
          <button onClick={() => setSuccess('')}><X size={14} /></button>
        </div>
      )}

      {/* Active Broker Highlight */}
      {activeBroker && (
        <div className="active-broker-banner">
          <div className="active-broker-info">
            <span 
              className="broker-logo-small" 
              style={{ background: getBrokerColor(activeBroker) }}
            >
              {getBrokerLogo(activeBroker)}
            </span>
            <div>
              <div className="active-broker-label">
                <Zap size={14} />
                Active Broker
              </div>
              <div className="active-broker-name">{activeBroker}</div>
            </div>
          </div>
          <div className="active-broker-stats">
            <Activity size={16} />
            <span>All orders will execute through this broker</span>
          </div>
        </div>
      )}

      {/* Broker Grid */}
      <div className="broker-connection-grid">
        {brokers.length === 0 ? (
          <div className="no-brokers-message">
            <Link2 size={48} />
            <h3>No Brokers Connected</h3>
            <p>Connect your first broker account to start trading</p>
            <button className="primary-button">
              Connect Broker <ChevronRight size={14} />
            </button>
          </div>
        ) : (
          brokers.map((broker) => (
            <div 
              key={broker.broker} 
              className={`broker-card ${broker.isActive ? 'active' : ''} ${broker.status !== 'CONNECTED' ? 'inactive' : ''}`}
            >
              {/* Card Header */}
              <div className="broker-card-header">
                <span 
                  className="broker-logo" 
                  style={{ background: getBrokerColor(broker.broker) }}
                >
                  {getBrokerLogo(broker.broker)}
                </span>
                <div className="broker-card-title">
                  <h3>{broker.broker}</h3>
                  {getStatusBadge(broker.status)}
                </div>
                {broker.isActive && (
                  <span className="active-badge">
                    <Zap size={12} />
                    Active
                  </span>
                )}
              </div>

              {/* Card Details */}
              <div className="broker-card-details">
                <div className="detail-row">
                  <span className="detail-label">Client ID</span>
                  <span className="detail-value">{broker.clientId || 'N/A'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Mode</span>
                  <span className="detail-value">{broker.mode}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Last Verified</span>
                  <span className="detail-value">{formatTimestamp(broker.lastVerifiedAt)}</span>
                </div>
                {broker.verificationScore !== null && broker.verificationScore !== undefined && (
                  <div className="detail-row">
                    <span className="detail-label">Verification Score</span>
                    <span className="detail-value score">
                      <div 
                        className="score-bar" 
                        style={{ 
                          width: `${broker.verificationScore}%`,
                          background: broker.verificationScore === 100 ? '#10b981' : 
                                    broker.verificationScore >= 70 ? '#f59e0b' : '#ef4444'
                        }}
                      />
                      <span>{broker.verificationScore}%</span>
                    </span>
                  </div>
                )}
              </div>

              {/* Card Actions */}
              {broker.status === 'CONNECTED' && (
                <div className="broker-card-actions">
                  {!broker.isActive && (
                    <button
                      className="action-button primary"
                      onClick={() => handleSetActiveBroker(broker.broker)}
                      disabled={switching}
                    >
                      <Check size={14} />
                      Set Active
                    </button>
                  )}
                  <button
                    className="action-button secondary"
                    onClick={() => handleRefreshBrokerData(broker.broker)}
                    disabled={refreshing[broker.broker]}
                  >
                    <RefreshCw size={14} className={refreshing[broker.broker] ? 'spin' : ''} />
                    Refresh
                  </button>
                  <button
                    className="action-button secondary"
                    onClick={() => handleVerifyBroker(broker.broker)}
                    disabled={refreshing[`${broker.broker}_verify`]}
                  >
                    <ShieldCheck size={14} />
                    Verify
                  </button>
                </div>
              )}

              {broker.status !== 'CONNECTED' && (
                <div className="broker-reconnect-prompt">
                  <AlertTriangle size={16} />
                  <span>
                    {broker.status === 'SESSION_EXPIRED' 
                      ? 'Session expired. Reconnect to continue.' 
                      : 'Connection failed. Please reconnect.'}
                  </span>
                  <button className="reconnect-button">
                    Reconnect <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Info Panel */}
      {hasMultipleBrokers && (
        <div className="broker-info-panel">
          <TrendingUp size={18} />
          <div>
            <strong>Multi-Broker Trading</strong>
            <p>
              You can run different strategies on different brokers simultaneously. 
              The active broker is used for manual orders and as the default for new strategies.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiBrokerManager;
