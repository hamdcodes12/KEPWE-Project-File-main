import React, { useState, useEffect } from 'react';
import { X, Megaphone } from 'lucide-react';
import { apiFetch } from '../../api/client';

/**
 * Global announcements display.
 * Fetches active announcements from the backend (/api/public/announcements)
 * and renders them based on their placement type:
 *   - popup  → centered modal that can be dismissed
 *   - banner → full-width bar at the top of the page
 *   - toast  → bottom-right toast notification
 *
 * Dismissals are remembered in sessionStorage so the user isn't nagged
 * repeatedly within the same browser session.
 */
const Announcements = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('kepwe_dismissed_announcements') || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await apiFetch('/public/announcements', { auth: false });
        if (res.ok && res.data?.announcements) {
          if (!cancelled) setAnnouncements(res.data.announcements);
        }
      } catch {
        // ignore — announcements are non-critical
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const dismiss = (id) => {
    setDismissed((prev) => {
      const next = [...prev, id];
      try {
        sessionStorage.setItem('kepwe_dismissed_announcements', JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
  };

  const visible = announcements.filter((a) => !dismissed.includes(a.id));
  if (visible.length === 0) return null;

  const popup = visible.find((a) => a.placement === 'popup');
  const banners = visible.filter((a) => a.placement === 'banner');
  const toasts = visible.filter((a) => a.placement === 'toast');

  const RenderAnnouncement = ({ a, style, onClose, type }) => (
    <div style={style}>
      {type !== 'banner' && (
        <button
          onClick={onClose}
          aria-label="Dismiss announcement"
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            background: 'none',
            border: 'none',
            color: 'inherit',
            opacity: 0.6,
            cursor: 'pointer',
            display: 'flex',
          }}
        >
          <X size={18} />
        </button>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: type !== 'banner' ? '8px' : 0 }}>
        <Megaphone size={18} color={type === 'banner' ? '#FFFFFF' : '#214ECF'} style={{ flexShrink: 0 }} />
        <span style={{ fontWeight: 800, fontSize: type === 'banner' ? '0.85rem' : '1rem', color: type === 'banner' ? '#FFFFFF' : '#172033' }}>
          {a.title}
        </span>
      </div>
      <p style={{
        margin: type === 'banner' ? '4px 0 0' : '8px 0 0',
        fontSize: type === 'banner' ? '0.82rem' : '0.9rem',
        color: type === 'banner' ? 'rgba(255,255,255,0.9)' : '#64748B',
        lineHeight: 1.5,
      }}>
        {a.message}
      </p>
      {a.button_text && (
        <a
          href={a.button_link || '#'}
          onClick={onClose}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            marginTop: '12px',
            padding: '8px 18px',
            borderRadius: '8px',
            background: type === 'banner' ? '#FFFFFF' : '#214ECF',
            color: type === 'banner' ? '#214ECF' : '#FFFFFF',
            fontWeight: 700,
            fontSize: '0.8rem',
            textDecoration: 'none',
          }}
        >
          {a.button_text} →
        </a>
      )}
    </div>
  );

  return (
    <>
      {/* Banner(s) — full width at top */}
      {banners.map((a) => (
        <div key={a.id} style={{ background: 'linear-gradient(90deg, #214ECF, #14B8A6)', color: '#FFFFFF', padding: '10px 20px', position: 'relative', zIndex: 300 }}>
          <RenderAnnouncement a={a} type="banner" onClose={() => dismiss(a.id)} />
        </div>
      ))}

      {/* Popup — centered modal */}
      {popup && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15,23,42,0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 4000,
          padding: '20px',
        }}>
          <div style={{
            maxWidth: '480px',
            width: '100%',
            background: '#FFFFFF',
            borderRadius: '16px',
            padding: '28px',
            position: 'relative',
            boxShadow: '0 20px 50px rgba(15,23,42,0.25)',
          }}>
            <RenderAnnouncement a={popup} type="popup" onClose={() => dismiss(popup.id)} />
          </div>
        </div>
      )}

      {/* Toasts — bottom right */}
      {toasts.slice(0, 2).map((a) => (
        <div key={a.id} style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          maxWidth: '360px',
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          padding: '18px',
          boxShadow: '0 12px 30px rgba(15,23,42,0.12)',
          zIndex: 4000,
        }}>
          <RenderAnnouncement a={a} type="toast" onClose={() => dismiss(a.id)} />
        </div>
      ))}
    </>
  );
};

export default Announcements;