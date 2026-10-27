import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronRight, Layers, Orbit, Swords, X } from 'lucide-react';
import { playSound } from '../audio';
import './ModeCard.css';
import { HardModeButton } from './HardModeButton';
import { progressLabel, type ModeId, type Progress } from '../game/campaign';

type Mode = { id: ModeId; title: string; subtitle: string; description: string; accent: string; rgb: string; label: string };

const mainModes: Mode[] = [
  { id: 'chapter-1', title: 'Chapter 1', subtitle: 'The Helios Breach', description: 'Lead your fleet through five tactical battles. Capture new worlds and push into enemy territory.', accent: '#73dcff', rgb: '115, 220, 255', label: 'Campaign · 5 battles' },
  { id: 'quick-match', title: 'Quick Match', subtitle: 'One battle. Total conquest.', description: 'A new balanced battlefield every time. Choose your expansion routes, defend your capital and conquer the system.', accent: '#ffc184', rgb: '255, 193, 132', label: 'Balanced random maps' },
  { id: 'chaos-mode', title: 'Chaos Mode', subtitle: 'A galaxy in motion.', description: 'Every planet orbits a star and produces one or two superweapons. Ride shifting routes and fight for a galaxy packed with power.', accent: '#a78bfa', rgb: '167, 139, 250', label: 'Orbiting weapon worlds' },
];

function Artwork({ mode }: { mode: Mode }) {
  return <><img className="mode-art" src={`/images/modes/${mode.id === 'chaos-mode' ? 'hard-mode' : mode.id}.jpg`} alt="" draggable={false} /><span className="mode-shade" /></>;
}

function CardContent({ mode, compact = false }: { mode: Mode; compact?: boolean }) {
  return <>
    <span className="mode-eyebrow">{mode.id === 'chaos-mode' ? <Orbit size={13} /> : mode.id === 'quick-match' ? <Swords size={13} /> : <Layers size={13} />}{mode.title}</span>
    <div className="mode-copy">
      <h2>{mode.subtitle}</h2>
      {mode.id === 'quick-match' && !compact ? (
        <ol className="mode-instructions">
          <li>Click your <strong>BLUE</strong> planet, then a target to attack.</li>
          <li>Protect your Capital at all costs.</li>
          <li>Hold marked planets to generate superweapon charges.</li>
        </ol>
      ) : <p>{mode.description}</p>}
    </div>
  </>;
}

export function ModeCard({ isSoundEnabled, selectedMode, onSelectMode, progress, isHardMode, setIsHardMode }: { isSoundEnabled: boolean; selectedMode: ModeId; onSelectMode: (mode: ModeId) => void; progress: Progress; isHardMode: boolean; setIsHardMode: (value: boolean) => void }) {
  const selected = mainModes.find(mode => mode.id === selectedMode) ?? mainModes[0];
  const dialog = useRef<HTMLDialogElement>(null);
  const changeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const element = dialog.current;
    // Native dialog focus can scroll the menu's otherwise hidden containers.
    const menuPositions: { element: HTMLElement; top: number; left: number }[] = [];
    for (let parent = changeButton.current?.parentElement; parent; parent = parent.parentElement) {
      menuPositions.push({ element: parent, top: parent.scrollTop, left: parent.scrollLeft });
    }
    const restoreFocus = () => {
      changeButton.current?.focus({ preventScroll: true });
      for (const position of menuPositions) {
        position.element.scrollTop = position.top;
        position.element.scrollLeft = position.left;
      }
    };
    element?.addEventListener('close', restoreFocus);
    return () => element?.removeEventListener('close', restoreFocus);
  }, []);

  return <>
    <section aria-label="Selected game mode" className={`mode-card mode-current ${selected.id === 'chaos-mode' ? 'mode-chaos' : ''}`}>
      <Artwork mode={selected} />
      <CardContent mode={selected} />
      <div className="mode-footer">
        <span className="mode-meta">{progressLabel(selectedMode, progress)}</span>
        <button ref={changeButton} type="button" aria-haspopup="dialog" onClick={() => { playSound('select', isSoundEnabled); dialog.current?.showModal(); }} className="mode-change">Change <ChevronRight size={17} /></button>
      </div>
    </section>
    {createPortal(<dialog ref={dialog} aria-labelledby="mode-picker-title" className="mode-dialog">
      <div className="mode-dialog-panel">
        <header className="mode-dialog-header">
          <div><p className="mode-dialog-kicker">Your next operation</p><h2 id="mode-picker-title">Choose your battlefield</h2></div>
          <button type="button" aria-label="Close mode selection" onClick={() => dialog.current?.close()} className="mode-close"><X size={22} /></button>
        </header>
        <div className="mode-grid">
          {mainModes.map(mode => (
            <button key={mode.id} type="button" aria-label={`Select ${mode.title}`} aria-pressed={selected.id === mode.id} onClick={() => { onSelectMode(mode.id); playSound('select', isSoundEnabled); dialog.current?.close(); }} className={`mode-card mode-option ${mode.id === 'chaos-mode' ? 'mode-chaos' : ''} ${selected.id === mode.id ? 'is-selected' : ''}`}>
              <Artwork mode={mode} />
              <CardContent mode={mode} compact />
              <div className="mode-footer"><span className="mode-meta">{progressLabel(mode.id, progress)}</span><span className="mode-select">{selected.id === mode.id ? <><Check size={15} /> Selected</> : <>Select <ChevronRight size={16} /></>}</span></div>
            </button>
          ))}
        </div>
        <p className="mode-dialog-hint">Select a mode, then launch from the main menu.</p>
      </div>
      <div className="mode-dialog-hard-mode">
        <HardModeButton isHardMode={isHardMode} setIsHardMode={setIsHardMode} isSoundEnabled={isSoundEnabled} />
      </div>
    </dialog>, document.body)}
  </>;
}
