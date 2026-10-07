import React, { useId } from 'react';
import { Info, X } from 'lucide-react';
import { SUPERWEAPON_VISUALS } from '../game/superweaponVisuals';
import type { SuperweaponId } from '../game/types';

type SuperweaponButtonProps = {
  weapon: SuperweaponId;
  label: string;
  description: string;
  chargeLabel: string;
  status: string;
  compactStatus: string;
  progress: number;
  charging: boolean;
  disabled: boolean;
  targeting: boolean;
  onActivate: () => void;
};

export function SuperweaponButton({ weapon, label, description, chargeLabel, status, compactStatus, progress, charging, disabled, targeting, onActivate }: SuperweaponButtonProps) {
  const infoId = useId();
  const headingId = useId();
  const visual = SUPERWEAPON_VISUALS[weapon];
  const explanation = `${description}. ${status}`;

  return <div className="planet-ability-card" style={{ '--weapon-color': visual.color } as React.CSSProperties}>
    <button type="button" className={`planet-ability ${weapon}${!disabled ? ' ready' : ''}${targeting ? ' targeting' : ''}`}
      disabled={disabled} aria-label={`${label}. ${status}`} aria-pressed={targeting} title={explanation} onClick={onActivate}>
      <span className="planet-ability-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {visual.paths.map(({ d, fill }, index) => <path key={index} d={d} fill={fill ? 'currentColor' : 'none'} stroke={fill ? 'none' : 'currentColor'} />)}
        </svg>
      </span>
      <span className="planet-ability-copy">
        <span className="planet-ability-title">
          <span className="planet-ability-name">
            <span className="planet-ability-full">{label}</span>
            <span className="planet-ability-compact">{weapon === 'overdrive' ? 'Overdrive' : weapon === 'repulse' ? 'Repulse' : label}</span>
          </span>
          <strong>{chargeLabel}</strong>
        </span>
        <small className="planet-ability-status">
          <span className="planet-ability-full">{targeting ? 'Choose a target world' : status}</span>
          <span className="planet-ability-compact">{targeting ? 'Targeting' : compactStatus}</span>
        </small>
        <span className={`planet-ability-track${charging ? ' charging' : ''}`} role={charging ? 'progressbar' : undefined}
          aria-hidden={!charging} aria-label={charging ? `${label} charge` : undefined}
          aria-valuemin={charging ? 0 : undefined} aria-valuemax={charging ? 100 : undefined}
          aria-valuenow={charging ? Math.floor(progress * 100) : undefined}>
          <span style={{ width: `${progress * 100}%` }} />
        </span>
      </span>
    </button>
    <button type="button" className="planet-ability-info" popoverTarget={infoId} title={`${label}: ${explanation}`}
      aria-label={`About ${label}`}><Info aria-hidden="true" size={14} /></button>
    <div id={infoId} className="planet-ability-details" popover="auto" role="dialog" aria-labelledby={headingId}>
      <button type="button" className="planet-ability-details-close" popoverTarget={infoId} popoverTargetAction="hide"
        aria-label={`Close ${label} information`}><X aria-hidden="true" size={16} /></button>
      <h3 id={headingId}>{label}</h3>
      <p>{description}.</p>
      <p className="planet-ability-details-status">{status}</p>
    </div>
  </div>;
}
