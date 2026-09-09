import { useEffect, useRef } from 'react';
import { ArrowRight, Crosshair, House, RotateCcw, ShieldCheck, ShieldX } from 'lucide-react';
import './ResultScreen.css';

type ResultScreenProps = {
  won: boolean;
  missionTitle: string;
  detail: string;
  actionLabel: string;
  onContinue: () => void;
  onMenu: () => void;
  onHover: () => void;
};

export function ResultScreen({ won, missionTitle, detail, actionLabel, onContinue, onMenu, onHover }: ResultScreenProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const primaryAction = useRef<HTMLButtonElement>(null);
  const replay = /retry|replay/i.test(actionLabel);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    primaryAction.current?.focus({ preventScroll: true });
    return () => element?.close();
  }, []);

  return (
    <dialog
      ref={dialog}
      className={`result-screen ${won ? 'result-victory' : 'result-defeat'}`}
      aria-labelledby="result-title"
      aria-describedby="result-detail"
      onCancel={event => event.preventDefault()}
      onKeyDown={event => event.stopPropagation()}
    >
      <section className="result-panel">
        <header className="result-header">
          <span><Crosshair size={14} aria-hidden="true" /> Mission debrief</span>
          <span className="result-status"><i /> {won ? 'Sector secure' : 'Signal lost'}</span>
        </header>

        <div className="result-body">
          <div className="result-hero">
            <div className="result-emblem" aria-hidden="true">
              <span className="result-orbit result-orbit-outer" />
              <span className="result-orbit result-orbit-inner" />
              <span className="result-planet" />
              {won ? <ShieldCheck size={38} strokeWidth={1.3} /> : <ShieldX size={38} strokeWidth={1.3} />}
            </div>
            <div>
              <p className="result-eyebrow">{won ? 'Mission accomplished' : 'Mission failed'}</p>
              <h2 id="result-title">{won ? 'VICTORY' : 'DEFEAT'}</h2>
              <p className="result-subtitle">{won ? 'The stars are yours, Commander.' : 'Regroup. Rebuild. Return.'}</p>
            </div>
          </div>

          <div className="result-briefing">
            <span className="result-briefing-marker" aria-hidden="true" />
            <div>
              <p className="result-mission">{missionTitle}</p>
              <p id="result-detail">{won ? detail : 'Your command has fallen. Rally your fleet and take back the system.'}</p>
            </div>
          </div>

          <div className="result-actions">
            <button ref={primaryAction} type="button" className="result-primary" onMouseEnter={onHover} onClick={onContinue}>
              <span>{actionLabel}</span>
              {replay ? <RotateCcw size={18} aria-hidden="true" /> : <ArrowRight size={18} aria-hidden="true" />}
            </button>
            <button type="button" className="result-secondary" onMouseEnter={onHover} onClick={onMenu}>
              <House size={16} aria-hidden="true" /> Main menu
            </button>
          </div>
        </div>

        <footer className="result-footer"><span>War of Planets</span><span>End of transmission <span aria-hidden="true">//</span></span></footer>
      </section>
    </dialog>
  );
}
