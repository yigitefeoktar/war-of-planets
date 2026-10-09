import React, { useId } from 'react';
import { Info, X } from 'lucide-react';
import { SUPERWEAPON_VISUALS } from '../game/superweaponVisuals';
import type { SuperweaponId } from '../game/types';

const COMPACT_LABELS: Record<SuperweaponId, string> = {
  overdrive: 'Overdrive', omni: 'Omni', repulse: 'Repulse',
};

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
      disabled={disabled} aria-label={`${label}. ${chargeLabel}. ${status}`} aria-pressed={targeting} title={explanation} onClick={onActivate}>
      <span className="planet-ability-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {visual.paths.map(({ d, fill }, index) => <path key={index} d={d} fill={fill ? 'currentColor' : 'none'} stroke={fill ? 'none' : 'currentColor'} />)}
        </svg>
      </span>
      <span className="planet-ability-copy">
        <span className="planet-ability-title">
          <span className="planet-ability-name">
            <span className="planet-ability-full">{label}</span>
            <span className="planet-ability-compact">{COMPACT_LABELS[weapon]}</span>
          </span>
          <strong>{chargeLabel}</strong>
        </span>
        <span className={`planet-ability-track${charging ? ' charging' : ''}`} role={charging ? 'progressbar' : undefined}
          aria-hidden={!charging} aria-label={charging ? `${label} charge` : undefined}
          aria-valuemin={charging ? 0 : undefined} aria-valuemax={charging ? 100 : undefined}
          aria-valuenow={charging ? Math.floor(progress * 100) : undefined}>
          <span style={{ width: `${progress * 100}%` }} />
        </span>
        <small className="planet-ability-status">
          <span className="planet-ability-full">{targeting ? 'Choose a target world' : status}</span>
          <span className="planet-ability-compact">{targeting ? 'Targeting' : compactStatus}</span>
        </small>
      </span>
    </button>
    <button type="button" className="planet-ability-info" popoverTarget={infoId} title={`${label}: ${explanation}`}
      aria-label={`About ${label}`}><Info aria-hidden="true" size={14} /></button>
    <div id={infoId} className="planet-ability-details" popover="auto" role="dialog" aria-labelledby={headingId}
      aria-describedby={`${infoId}-effect`}>
      <header className="planet-ability-details-header">
        <span className="planet-ability-details-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {visual.paths.map(({ d, fill }, index) => <path key={index} d={d} fill={fill ? 'currentColor' : 'none'} stroke={fill ? 'none' : 'currentColor'} />)}
          </svg>
        </span>
        <div>
          <span className="planet-ability-details-kicker">Superweapon</span>
          <h3 id={headingId}>{label}</h3>
        </div>
      </header>
      <div className="planet-ability-details-body">
        <section className="planet-ability-details-effect" aria-label="Weapon effect">
          <h4>Effect</h4>
          <p id={`${infoId}-effect`}>{description}.</p>
        </section>
        <section className="planet-ability-details-state" aria-label="Weapon status">
          <div className="planet-ability-details-state-heading"><h4>Status</h4><strong>{chargeLabel}</strong></div>
          <p className="planet-ability-details-status">{status}</p>
        </section>
      </div>
      <footer className="planet-ability-details-footer">
        <button type="button" className="planet-ability-details-close" popoverTarget={infoId} popoverTargetAction="hide"
          aria-label={`Close ${label} information`} autoFocus><X aria-hidden="true" size={18} /><span>Close</span></button>
      </footer>
    </div>
  </div>;
}
