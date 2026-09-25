import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

const VerdictBadge = ({ state, size = 'medium', showDescription = false }) => {
  let label = '';
  let Icon = CheckCircle2;
  let bgStyle = '';
  let textStyle = '';
  let borderStyle = '';
  let descText = '';

  switch (state) {
    case 'TRADE':
      label = 'TRADE';
      Icon = CheckCircle2;
      bgStyle = '#F0FDF4';
      borderStyle = '#86EFAC';
      textStyle = '#166534';
      descText = 'Edge identified within risk limits. Strategy cards unlocked.';
      break;
    case 'CAUTION':
      label = 'CAUTION';
      Icon = AlertTriangle;
      bgStyle = '#FFFBEB';
      borderStyle = '#FDE68A';
      textStyle = '#B45309';
      descText = 'Mixed signals or event risk ahead. Reduced size only.';
      break;
    case 'NO_TRADE':
    default:
      label = 'NO TRADE';
      Icon = XCircle;
      bgStyle = '#FEF2F2';
      borderStyle = '#FCA5A5';
      textStyle = '#DC2626';
      descText = 'No statistical edge found. Strategy engine recommends sitting out.';
      break;
  }

  const padding = size === 'large' ? '6px 14px' : size === 'small' ? '2px 8px' : '4px 10px';
  const fontSize = size === 'large' ? '12px' : size === 'small' ? '10px' : '11px';
  const iconSize = size === 'large' ? 15 : size === 'small' ? 12 : 13;

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '4px' }}>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          padding: padding,
          borderRadius: '6px',
          backgroundColor: bgStyle,
          color: textStyle,
          border: `1px solid ${borderStyle}`,
          fontWeight: 700,
          fontSize: fontSize,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          width: 'fit-content'
        }}
      >
        <Icon size={iconSize} />
        <span>{label}</span>
      </div>
      {showDescription && (
        <span style={{ fontSize: '12px', color: '#64748B' }}>
          {descText}
        </span>
      )}
    </div>
  );
};

export default VerdictBadge;
