import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';
import kepweLogo from '../assets/KEPWWE LOGO.png';

const NotFoundPage = () => {
  const navigate = useNavigate();

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
          background: 'linear-gradient(135deg, #214ECF, #14B8A6)',
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
          width: '220px',
          height: '220px',
          background: 'radial-gradient(circle, rgba(33,78,207,0.18) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
      </div>

      {/* Brand mark: Pure KEPWE */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <img
          src={kepweLogo}
          alt="KEPWE"
          style={{ width: '38px', height: '38px', objectFit: 'contain' }}
        />
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em', lineHeight: 1 }}>
            KEPWE
          </div>
          <div style={{ fontSize: '0.62rem', color: '#94A3B8', fontWeight: 700, letterSpacing: '0.08em', marginTop: '3px' }}>
            BUSINESS PLATFORM
          </div>
        </div>
      </div>

      <h1 style={{ fontSize: 'clamp(1.4rem, 4vw, 2.2rem)', fontWeight: 800, color: '#FFFFFF', marginBottom: '12px', maxWidth: '480px' }}>
        Page not found
      </h1>
      <p style={{ color: '#94A3B8', fontSize: '1rem', marginBottom: '36px', maxWidth: '420px', lineHeight: 1.6 }}>
        The route you're looking for doesn't exist or may have moved.
      </p>

      {/* Primary Action Buttons: Kepwe Home & Back */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', justifyContent: 'center', marginBottom: '40px' }}>
        <Link
          to="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 24px',
            borderRadius: '10px',
            background: '#214ECF',
            color: '#FFFFFF',
            fontWeight: 700,
            fontSize: '0.92rem',
            textDecoration: 'none',
            boxShadow: '0 4px 14px rgba(33, 78, 207, 0.35)',
            transition: 'all 0.2s ease',
          }}
        >
          <Home size={16} /> Kepwe Home
        </Link>

        <button
          type="button"
          onClick={() => {
            if (window.history.length > 1) {
              navigate(-1);
            } else {
              navigate('/');
            }
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 24px',
            borderRadius: '10px',
            border: '1px solid #2A3350',
            background: '#141C2E',
            color: '#E2E8F0',
            fontWeight: 700,
            fontSize: '0.92rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <ArrowLeft size={16} /> Back
        </button>
      </div>

      <p style={{ marginTop: '24px', color: '#5B6478', fontSize: '0.8rem' }}>
        Error code 404 · KEPWE Platform
      </p>
    </div>
  );
};

export default NotFoundPage;
