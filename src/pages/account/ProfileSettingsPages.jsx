import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  User, 
  Mail, 
  Shield, 
  CheckCircle2, 
  Save, 
  Lock, 
  Bell, 
  LogOut, 
  ChevronRight, 
  Camera, 
  Trash2, 
  Upload, 
  AlertCircle, 
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  X,
  Check
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

// ────────────────────────────────────────────────────────────────
// AVATAR CROP & ADJUST MODAL
// ────────────────────────────────────────────────────────────────
const AvatarCropModal = ({ imageSrc, isOpen, onClose, onSave, isSaving }) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [cropError, setCropError] = useState('');
  const imgRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setCropError('');
    }
  }, [isOpen, imageSrc]);

  if (!isOpen || !imageSrc) return null;

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y });
    }
  };

  const handleTouchMove = (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    setPan({ x: e.touches[0].clientX - dragStart.x, y: e.touches[0].clientY - dragStart.y });
  };

  const handleTouchEnd = () => setIsDragging(false);

  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleApplyCrop = () => {
    if (!imgRef.current) return;
    try {
      const img = imgRef.current;
      const naturalW = img.naturalWidth;
      const naturalH = img.naturalHeight;
      if (!naturalW || !naturalH) {
        setCropError('Failed to read image dimensions.');
        return;
      }

      // Crop guide circle is 240px inside 300x300 container
      const CROP_DIAMETER = 240;
      const OUTPUT_SIZE = 400; // Crisp output avatar
      const outputScale = OUTPUT_SIZE / CROP_DIAMETER;

      // Base scaling to fit image nicely into crop diameter
      const baseScale = Math.max(CROP_DIAMETER / naturalW, CROP_DIAMETER / naturalH);

      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext('2d');

      // Center context at output canvas center
      ctx.translate(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2);
      ctx.translate(pan.x * outputScale, pan.y * outputScale);
      const totalScale = baseScale * zoom * outputScale;
      ctx.scale(totalScale, totalScale);

      // Draw image centered
      ctx.drawImage(img, -naturalW / 2, -naturalH / 2, naturalW, naturalH);

      canvas.toBlob((blob) => {
        if (!blob) {
          setCropError('Failed to process cropped avatar.');
          return;
        }
        const croppedFile = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
        onSave(croppedFile);
      }, 'image/jpeg', 0.92);
    } catch (err) {
      setCropError(err.message || 'Error processing crop.');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) onClose();
      }}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '20px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          maxWidth: '460px',
          width: '100%',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid #E2E8F0',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid #F1F5F9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#172033' }}>
              Crop & Position Avatar
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748B' }}>
              Drag the photo to reposition. Use the slider or buttons to zoom.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close crop modal"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              padding: '6px',
              color: '#94A3B8',
              borderRadius: '8px',
              display: 'flex',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body / Interactive Preview */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {cropError && (
            <div
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#DC2626',
                borderRadius: '8px',
                fontSize: '12px',
                marginBottom: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <AlertCircle size={14} /> {cropError}
            </div>
          )}

          {/* Interactive Drag & Crop Viewport */}
          <div
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{
              width: '300px',
              height: '300px',
              position: 'relative',
              overflow: 'hidden',
              borderRadius: '16px',
              backgroundColor: '#0F172A',
              cursor: isDragging ? 'grabbing' : 'grab',
              userSelect: 'none',
              touchAction: 'none',
            }}
          >
            {/* The Image */}
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Crop preview"
              draggable={false}
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`,
                transformOrigin: 'center center',
                maxWidth: 'none',
                maxHeight: 'none',
                pointerEvents: 'none',
                userSelect: 'none',
                minWidth: '240px',
                minHeight: '240px',
                objectFit: 'contain',
              }}
            />

            {/* Circular Mask & Border Overlay */}
            <div
              style={{
                position: 'absolute',
                top: '30px',
                left: '30px',
                width: '240px',
                height: '240px',
                borderRadius: '50%',
                boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.68)',
                border: '2px dashed rgba(255, 255, 255, 0.9)',
                pointerEvents: 'none',
              }}
            />

            {/* Center crosshair dot */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: '6px',
                height: '6px',
                transform: 'translate(-50%, -50%)',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.5)',
                pointerEvents: 'none',
              }}
            />
          </div>

          {/* Zoom Controls */}
          <div style={{ width: '100%', marginTop: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                Zoom
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={handleReset}
                  title="Reset Position & Zoom"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#214ECF',
                    background: 'rgba(33, 78, 207, 0.08)',
                    border: 'none',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  <RotateCcw size={11} /> Reset
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(1, Number((z - 0.1).toFixed(2))))}
                aria-label="Zoom out"
                style={{
                  background: '#F1F5F9',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#475569',
                }}
              >
                <ZoomOut size={16} />
              </button>
              <input
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                style={{
                  flex: 1,
                  accentColor: '#214ECF',
                  cursor: 'pointer',
                  height: '6px',
                }}
              />
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(3, Number((z + 0.1).toFixed(2))))}
                aria-label="Zoom in"
                style={{
                  background: '#F1F5F9',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#475569',
                }}
              >
                <ZoomIn size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div
          style={{
            padding: '16px 24px',
            backgroundColor: '#F8FAFC',
            borderTop: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            style={{
              padding: '9px 18px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#64748B',
              backgroundColor: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              cursor: isSaving ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApplyCrop}
            disabled={isSaving}
            style={{
              padding: '9px 20px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#FFFFFF',
              backgroundColor: '#214ECF',
              border: 'none',
              borderRadius: '8px',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(33, 78, 207, 0.25)',
            }}
          >
            {isSaving ? (
              <>
                <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Saving...
              </>
            ) : (
              <>
                <Check size={15} /> Save Avatar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────
// PROFILE PAGE
// ────────────────────────────────────────────────────────────────
export const ProfilePage = () => {
  const { authState, uploadProfilePhoto, removeProfilePhoto } = useApp();
  const user = authState?.user;
  const fileInputRef = useRef(null);

  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Crop modal state
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState(null);
  const [savingCrop, setSavingCrop] = useState(false);

  const name = user?.name || 'User';
  const email = user?.email || '';
  const plan = user?.plan || 'Free Trial';
  const role = user?.role || 'user';
  const avatarUrl = user?.avatarUrl;
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || 'U';

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg('');
    setSuccessMsg('');

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      setErrorMsg('Please select a valid image file (JPEG, PNG, WebP, or GIF).');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Image file size must be less than 5MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCropImageSrc(reader.result);
      setCropModalOpen(true);
    };
    reader.onerror = () => {
      setErrorMsg('Failed to read image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveCroppedPhoto = async (croppedFile) => {
    setSavingCrop(true);
    setErrorMsg('');
    setSuccessMsg('');
    const res = await uploadProfilePhoto(croppedFile);
    setSavingCrop(false);

    if (res.success) {
      setCropModalOpen(false);
      setCropImageSrc(null);
      setSuccessMsg('Profile photo updated successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } else {
      setErrorMsg(res.error || 'Failed to upload cropped photo.');
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCancelCrop = () => {
    setCropModalOpen(false);
    setCropImageSrc(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemovePhoto = async () => {
    if (!window.confirm('Are you sure you want to remove your profile photo?')) return;
    setErrorMsg('');
    setSuccessMsg('');
    setUploading(true);
    const res = await removeProfilePhoto();
    setUploading(false);
    if (res.success) {
      setSuccessMsg('Profile photo removed.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } else {
      setErrorMsg(res.error || 'Failed to remove photo.');
    }
  };

  return (
    <div style={{
      backgroundColor: '#F5F8FC',
      backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(20, 184, 166, 0.035), transparent 45%)',
      color: '#172033',
      minHeight: '100vh',
      padding: '32px 40px 60px',
      fontFamily: 'var(--font-ui)'
    }}>
      {/* Avatar Crop Modal */}
      <AvatarCropModal
        isOpen={cropModalOpen}
        imageSrc={cropImageSrc}
        onClose={handleCancelCrop}
        onSave={handleSaveCroppedPhoto}
        isSaving={savingCrop}
      />

      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#14B8A6' }} />
            <span style={{ fontSize: '12px', color: '#0F9F8F', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              ACCOUNT
            </span>
          </div>
          <h1 style={{ fontSize: '30px', fontWeight: 700, letterSpacing: '-0.025em', lineHeight: '1.15', color: '#172033', margin: 0 }}>
            Your Profile
          </h1>
        </div>

        {/* Identity Card */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '16px',
          boxShadow: '0 8px 22px rgba(15, 23, 42, 0.045)',
          padding: '28px',
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          flexWrap: 'wrap',
          marginBottom: '24px'
        }}>
          <div style={{ position: 'relative' }}>
            <div style={{
              width: '88px',
              height: '88px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #214ECF, #14B8A6)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '2rem',
              letterSpacing: '0.02em',
              flexShrink: 0,
              overflow: 'hidden',
              boxShadow: '0 4px 14px rgba(33, 78, 207, 0.2)',
              border: '3px solid #FFFFFF'
            }}>
              {avatarUrl ? (
                <img
                  key={avatarUrl}
                  src={avatarUrl}
                  alt={name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              ) : (
                initials
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="Upload profile photo"
              aria-label="Upload profile photo"
              style={{
                position: 'absolute',
                bottom: '0',
                right: '0',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: '#214ECF',
                color: '#FFFFFF',
                border: '2px solid #FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: uploading ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                transition: 'all 0.15s ease',
              }}
            >
              {uploading ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Camera size={15} />}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>

          <div style={{ flex: 1, minWidth: '220px' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#172033' }}>{name}</div>
            <div style={{ fontSize: '0.9rem', color: '#64748B', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Mail size={14} /> {email}
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ background: 'rgba(20, 184, 166, 0.1)', border: '1px solid rgba(20, 184, 166, 0.25)', color: '#0F9F8F', borderRadius: '6px', fontSize: '11px', fontWeight: 700, padding: '4px 10px' }}>
                {plan}
              </span>
              <span style={{ background: 'rgba(33, 78, 207, 0.08)', border: '1px solid rgba(33, 78, 207, 0.2)', color: '#214ECF', borderRadius: '6px', fontSize: '11px', fontWeight: 700, padding: '4px 10px', textTransform: 'capitalize' }}>
                {role}
              </span>
            </div>

            {/* Photo actions & info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '14px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#214ECF',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '7px 14px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                <Upload size={14} /> {avatarUrl ? 'Change Photo' : 'Upload Photo'}
              </button>

              {avatarUrl && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  disabled={uploading}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: '#FEF2F2',
                    color: '#DC2626',
                    border: '1px solid #FEE2E2',
                    borderRadius: '8px',
                    padding: '7px 14px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: uploading ? 'not-allowed' : 'pointer',
                    transition: 'background 0.15s',
                  }}
                >
                  <Trash2 size={14} /> Remove Photo
                </button>
              )}

              <span style={{ fontSize: '12px', color: '#94A3B8' }}>
                JPG, PNG, WebP or GIF up to 5MB
              </span>
            </div>

            {errorMsg && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#DC2626', fontSize: '12px', marginTop: '8px', fontWeight: 500 }}>
                <AlertCircle size={14} /> {errorMsg}
              </div>
            )}
            {successMsg && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#059669', fontSize: '12px', marginTop: '8px', fontWeight: 500 }}>
                <CheckCircle2 size={14} /> {successMsg}
              </div>
            )}
          </div>
        </div>

        {/* Account Details */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', boxShadow: '0 8px 22px rgba(15, 23, 42, 0.045)', padding: '24px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#0F9F8F', letterSpacing: '0.03em', textTransform: 'uppercase', marginBottom: '16px' }}>
            ACCOUNT DETAILS
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              { label: 'Full Name', value: name, icon: <User size={15} color="#64748B" /> },
              { label: 'Email Address', value: email, icon: <Mail size={15} color="#64748B" /> },
              { label: 'Plan', value: plan, icon: <Shield size={15} color="#64748B" /> },
            ].map((row) => (
              <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', background: '#FFFFFF', border: '1px solid #E2E8F0', flexShrink: 0 }}>
                  {row.icon}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>{row.label}</div>
                  <div style={{ fontSize: '14px', color: '#172033', fontWeight: 700 }}>{row.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────
// SETTINGS PAGE
// ────────────────────────────────────────────────────────────────
export const SettingsPage = () => {
  const { authState, logout, alertsConfig, setAlertsConfig, saveAlertsConfig } = useApp();
  const navigate = useNavigate();
  const user = authState?.user;
  const name = user?.name || 'User';
  const email = user?.email || '';

  const [saved, setSaved] = useState(false);
  const [displayName, setDisplayName] = useState(name);

  const handleSave = async () => {
    const result = await saveAlertsConfig();
    if (result.success) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const toggleChannel = (ch) => setAlertsConfig((p) => ({ ...p, channels: { ...p.channels, [ch]: !p.channels[ch] } }));

  return (
    <div style={{
      backgroundColor: '#F5F8FC',
      backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(20, 184, 166, 0.035), transparent 45%)',
      color: '#172033',
      minHeight: '100vh',
      padding: '32px 40px 60px',
      fontFamily: 'var(--font-ui)'
    }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#14B8A6' }} />
            <span style={{ fontSize: '12px', color: '#0F9F8F', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              ACCOUNT
            </span>
          </div>
          <h1 style={{ fontSize: '30px', fontWeight: 700, letterSpacing: '-0.025em', lineHeight: '1.15', color: '#172033', margin: 0 }}>
            Settings
          </h1>
        </div>

        {saved && (
          <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid #10B981', borderRadius: '10px', padding: '12px 16px', marginBottom: '24px', color: '#10B981', fontWeight: 700, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} color="#10B981" />
            Settings saved successfully.
          </div>
        )}

        {/* Profile Settings */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', boxShadow: '0 8px 22px rgba(15, 23, 42, 0.045)', padding: '24px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#0F9F8F', letterSpacing: '0.03em', textTransform: 'uppercase', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={15} /> PROFILE
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#64748B', fontWeight: 600, marginBottom: '6px' }}>
                Display Name
              </label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                style={{ width: '100%', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px 14px', color: '#172033', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#64748B', fontWeight: 600, marginBottom: '6px' }}>
                Email Address
              </label>
              <input
                value={email}
                disabled
                style={{ width: '100%', background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px 14px', color: '#94A3B8', fontSize: '13px', outline: 'none', boxSizing: 'border-box', cursor: 'not-allowed' }}
              />
              <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>Email cannot be changed.</div>
            </div>
          </div>
        </div>

        {/* Password Change */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', boxShadow: '0 8px 22px rgba(15, 23, 42, 0.045)', padding: '24px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#0F9F8F', letterSpacing: '0.03em', textTransform: 'uppercase', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Lock size={15} style={{ color: '#214ECF' }} /> PASSWORD & SECURITY
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#64748B', fontWeight: 600, marginBottom: '6px' }}>
                <Lock size={13} style={{ color: '#214ECF' }} /> Current Password
              </label>
              <input
                type="password"
                placeholder="Enter your current password"
                style={{ width: '100%', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px 14px', color: '#172033', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#64748B', fontWeight: 600, marginBottom: '6px' }}>
                <Lock size={13} style={{ color: '#214ECF' }} /> New Password
              </label>
              <input
                type="password"
                placeholder="Enter your new password"
                style={{ width: '100%', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px 14px', color: '#172033', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
              />
              <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>At least 8 characters, with uppercase, lowercase, and a number.</div>
            </div>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#64748B', fontWeight: 600, marginBottom: '6px' }}>
                <Lock size={13} style={{ color: '#214ECF' }} /> Confirm New Password
              </label>
              <input
                type="password"
                placeholder="Confirm your new password"
                style={{ width: '100%', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px 14px', color: '#172033', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <button
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '8px', padding: '10px 22px', borderRadius: '8px', background: '#214ECF', color: '#FFFFFF', border: 'none', fontWeight: 700, fontSize: '12px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(33, 78, 207, 0.2)' }}
            >
              <Save size={15} /> Update Password
            </button>
          </div>
        </div>

        {/* Notification Preferences */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', boxShadow: '0 8px 22px rgba(15, 23, 42, 0.045)', padding: '24px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#0F9F8F', letterSpacing: '0.03em', textTransform: 'uppercase', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell size={15} style={{ color: '#214ECF' }} /> NOTIFICATION CHANNELS
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { key: 'push', label: 'Push Notifications', desc: 'In-app and browser push alerts' },
              { key: 'email', label: 'Email Notifications', desc: 'Send alerts to your email address' },
              { key: 'sms', label: 'SMS Notifications', desc: 'Text message alerts (charges may apply)' },
            ].map((ch) => (
              <div key={ch.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#172033' }}>{ch.label}</div>
                  <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>{ch.desc}</div>
                </div>
                <button
                  onClick={() => toggleChannel(ch.key)}
                  style={{
                    width: '44px',
                    height: '24px',
                    borderRadius: '12px',
                    border: 'none',
                    background: alertsConfig.channels[ch.key] ? '#14B8A6' : '#CBD5E1',
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                    flexShrink: 0
                  }}
                  aria-label={`Toggle ${ch.label}`}
                >
                  <span style={{
                    position: 'absolute',
                    top: '3px',
                    left: alertsConfig.channels[ch.key] ? '23px' : '3px',
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: '#FFFFFF',
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                  }} />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={handleSave}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '16px', padding: '10px 22px', borderRadius: '8px', background: '#14B8A6', color: '#062B27', border: 'none', fontWeight: 700, fontSize: '12px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(20, 184, 166, 0.2)' }}
          >
            <Save size={15} /> Save Settings
          </button>
        </div>

        {/* Security / Session */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', boxShadow: '0 8px 22px rgba(15, 23, 42, 0.045)', padding: '24px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#0F9F8F', letterSpacing: '0.03em', textTransform: 'uppercase', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Lock size={15} style={{ color: '#214ECF' }} /> SECURITY & SESSION
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#172033' }}>Sign Out</div>
                <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>End your current session and return to the login page.</div>
              </div>
              <button
                onClick={handleLogout}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', background: 'transparent', border: '1px solid rgba(239, 68, 68, 0.35)', color: '#EF4444', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}
              >
                <LogOut size={14} /> Logout
              </button>
            </div>
          </div>
        </div>

        {/* Quick links */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <Link to="/profile" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 18px', borderRadius: '8px', background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#172033', fontWeight: 700, fontSize: '12px', textDecoration: 'none' }}>
            View Profile <ChevronRight size={14} />
          </Link>
          <Link to="/app/account" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 18px', borderRadius: '8px', background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#172033', fontWeight: 700, fontSize: '12px', textDecoration: 'none' }}>
            IndexPilot Account <ChevronRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
};