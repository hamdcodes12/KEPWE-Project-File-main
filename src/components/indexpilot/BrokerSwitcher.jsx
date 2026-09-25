import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check, Zap, RefreshCw, AlertTriangle } from 'lucide-react';
import './BrokerSwitcher.css';

/**
 * Compact Broker Switcher Component
 * Displays active broker and allows quick switching
 */
const BrokerSwitcher = ({ onBrokerChange }) => {
  const [brokers, setBrokers] = useState([]);
  const [activeBroker, setActiveBroker] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const dropdownRef = useRef(null);

  // Load broker connections
  useEffect(() => {
    loadBrokers();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadBrokers = async () => {
    try {
      const response = await fetch('/api/broker/connections', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kepwe_access_token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const connected = data.brokers.filter(b => b.status === 'CONNECTED');
        setBrokers(connected);
        setActiveBroker(data.activeBroker);
      }
    } catch (err) {
      console.error('Failed to load brokers:', err);
    }
  };

  const handleBrokerSwitch = async (broker) => {
    if (broker === activeBroker || switching) return;

    setSwitching(true);
    setIsOpen(false);

    try {
      const response = await fetch('/api/broker/set-active', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('kepwe_access_token')}`,
        },
        body: JSON.stringify({ broker }),
      });

      if (response.ok) {
        setActiveBroker(broker);
        if (onBrokerChange) {
          onBrokerChange(broker);
        }
      }
    } catch (err) {
      console.error('Failed to switch broker:', err);
    } finally {
      setSwitching(false);
    }
  };

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

  const getBrokerName = (broker) => {
    switch (broker) {
      case 'DHAN':
        return 'Dhan';
      case 'ANGEL_ONE':
        return 'Angel One';
      default:
        return broker;
    }
  };

  if (brokers.length === 0) {
    return (
      <div className="broker-switcher no-brokers">
        <AlertTriangle size={14} />
        <span>No brokers connected</span>
      </div>
    );
  }

  if (brokers.length === 1) {
    const broker = brokers[0];
    return (
      <div className="broker-switcher single-broker">
        <span 
          className="broker-indicator" 
          style={{ background: getBrokerColor(broker.broker) }}
        >
          {getBrokerLogo(broker.broker)}
        </span>
        <div className="broker-info">
          <div className="broker-label">Active Broker</div>
          <div className="broker-name">{getBrokerName(broker.broker)}</div>
        </div>
        <Zap size={14} className="active-icon" />
      </div>
    );
  }

  return (
    <div className="broker-switcher multi-broker" ref={dropdownRef}>
      <button 
        className="broker-selector"
        onClick={() => setIsOpen(!isOpen)}
        disabled={switching}
      >
        {switching ? (
          <>
            <RefreshCw size={14} className="spin" />
            <span>Switching...</span>
          </>
        ) : activeBroker ? (
          <>
            <span 
              className="broker-indicator" 
              style={{ background: getBrokerColor(activeBroker) }}
            >
              {getBrokerLogo(activeBroker)}
            </span>
            <div className="broker-info">
              <div className="broker-label">Active Broker</div>
              <div className="broker-name">{getBrokerName(activeBroker)}</div>
            </div>
            <ChevronDown size={16} className={isOpen ? 'rotated' : ''} />
          </>
        ) : (
          <>
            <AlertTriangle size={14} />
            <span>No active broker</span>
            <ChevronDown size={16} className={isOpen ? 'rotated' : ''} />
          </>
        )}
      </button>

      {isOpen && (
        <div className="broker-dropdown">
          <div className="dropdown-header">Switch Active Broker</div>
          <div className="broker-list">
            {brokers.map((broker) => (
              <button
                key={broker.broker}
                className={`broker-option ${broker.broker === activeBroker ? 'active' : ''}`}
                onClick={() => handleBrokerSwitch(broker.broker)}
                disabled={broker.broker === activeBroker}
              >
                <span 
                  className="broker-indicator-small" 
                  style={{ background: getBrokerColor(broker.broker) }}
                >
                  {getBrokerLogo(broker.broker)}
                </span>
                <div className="broker-details">
                  <div className="broker-name-large">{getBrokerName(broker.broker)}</div>
                  <div className="broker-client">
                    Client: {broker.clientId || 'Connected'}
                  </div>
                </div>
                {broker.broker === activeBroker && (
                  <Check size={16} className="check-icon" />
                )}
              </button>
            ))}
          </div>
          <div className="dropdown-footer">
            <button 
              className="refresh-button" 
              onClick={(e) => {
                e.stopPropagation();
                loadBrokers();
              }}
            >
              <RefreshCw size={12} />
              Refresh
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BrokerSwitcher;
