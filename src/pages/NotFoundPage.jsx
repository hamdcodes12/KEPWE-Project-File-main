import React from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, Home, LayoutDashboard, IndianRupee, Search, ArrowLeft } from 'lucide-react';

const NotFoundPage = () => {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0A0E17 0%, #111826 60%, #0A0E17 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      fontFamily: "'Inter', sans-serif",
      textAlign: 'center',
    }}>
      {/* Glowing 404 */}
      <div style={{ position: 'relative', marginBottom: '24px' }}>
        <div style={{
          fontSize: 'clamp(6rem, 20vw, 10rem)',
          fontWeight: 900,
          color: 'transparent',
          background: 'linear-gradient(135deg, #17E7C0, #8B7CFF)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          lineHeight: 1,
          letterSpacing: '-0.05em',
        }}>
          404
        </div>
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '200px',
          height: '200px',
          background: 'radial-gradient(circle, rgba(23,231,192,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
      </div>

      {/* Brand mark */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '50%', border: '2px solid #17E7C0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <TrendingUp size={18} color="#17E7C0" />
        </div>
        <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFFFFF' }}>IndexPilot</span>
        <span style={{ fontSize: '0.65rem', color: '#17E7C0', fontWeight: 700 }}>BY KEPWE</span>
      </div>

      <h1 style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)', fontWeight: 800, color: '#FFFFFF', marginBottom: '12px', maxWidth: '480px' }}>
        Page not found
      </h1>
      <p style={{ color: '#98A2BC', fontSize: '1rem', marginBottom: '40px', maxWidth: '380px', lineHeight: 1.6 }}>
        The route you're looking for doesn't exist or may have moved. Use the links below to get back on track.
      </p>

      {/* Nav links */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center', marginBottom: '48px' }}>
        {[
          { to: '/', icon: <Home size={16} />, label: 'Kepwe Home', color: '#214ECF' },
          { to: '/app/dashboard', icon: <LayoutDashboard size={16} />, label: 'Trading Dashboard', color: '#17E7C0' },
          { to: '/indexpilot/pricing', icon: <IndianRupee size={16} />, label: 'Pricing', color: '#8B7CFF' },
        ].map((item) => (
          <Link
            key={item.to}
            to={item.to}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 22px',
              borderRadius: '10px',
              border: `1px solid ${item.color}30`,
              background: `${item.color}15`,
              color: item.color,
              fontWeight: 700,
              fontSize: '0.9rem',
              textDecoration: 'none',
              transition: 'all 0.2s',
            }}
          >
            {item.icon} {item.label}
          </Link>
        ))}
      </div>

      {/* Optional search hint */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        background: '#111826',
        border: '1px solid #2A3350',
        borderRadius: '10px',
        padding: '12px 20px',
        color: '#5B6478',
        fontSize: '0.85rem',
        maxWidth: '360px',
        width: '100%',
      }}>
        <Search size={16} color="#5B6478" />
        <span>Try navigating via the header menu</span>
      </div>

      <p style={{ marginTop: '32px', color: '#5B6478', fontSize: '0.8rem' }}>
        Error code 404 · IndexPilot by Kepwe
      </p>
    </div>
  );
};

export default NotFoundPage;
