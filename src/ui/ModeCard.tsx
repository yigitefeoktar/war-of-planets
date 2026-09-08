import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronRight, Layers, Swords, X } from 'lucide-react';
import { playSound } from '../audio';
import './ModeCard.css';
import { progressLabel, type ModeId, type Progress } from '../game/campaign';

const modes = [
  { id: 'chapter-1', title: 'Chapter 1', subtitle: 'The Helios Breach', description: 'Lead your fleet through five tactical battles. Capture new worlds and push into enemy territory.', accent: '#73dcff', rgb: '115, 220, 255', label: 'Campaign · 5 battles' },
  { id: 'chapter-2', title: 'Chapter 2', subtitle: 'Beyond Helios', description: 'Take the campaign deeper into space. New battlefields and greater challenges await your fleet.', accent: '#c4a3ff', rgb: '196, 163, 255', label: 'Campaign · 5 battles' },
  { id: 'quick-match', title: 'Quick Match', subtitle: 'One battle. Total conquest.', description: 'Command your fleet. Defend your capital. Conquer the system.', accent: '#ffc184', rgb: '255, 193, 132', label: 'Instant action' },
];
type Mode = typeof modes[number];

function Artwork({ mode }: { mode: Mode }) {
  return <><img className="mode-art" src={`/images/modes/${mode.id}.jpg`} alt="" draggable={false} /><span className="mode-shade" /></>;
}

function CardContent({ mode, compact = false }: { mode: Mode; compact?: boolean }) {
  return <>
    <span className="mode-eyebrow">{mode.id === 'quick-match' ? <Swords size={13} /> : <Layers size={13} />}{mode.title}</span>
    <div className="mode-copy">
      <h2>{mode.subtitle}</h2>
      {mode.id === 'quick-match' && !compact ? (
        <ol className="mode-instructions">
          <li>Click your <strong>BLUE</strong> planet, then a target to attack.</li>
          <li>Protect your Capital at all costs.</li>
          <li>Capture 5 planets to unlock Omni-Strike.</li>
        </ol>
      ) : <p>{mode.description}</p>}
    </div>
  </>;
}

export function ModeCard({ isSoundEnabled, selectedMode, onSelectMode, progress }: { isSoundEnabled: boolean; selectedMode: ModeId; onSelectMode: (mode: ModeId) => void; progress: Progress }) {
  const selected = modes.find(mode => mode.id === selectedMode) ?? modes[0];
  const dialog = useRef<HTMLDialogElement>(null);
  const changeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const element = dialog.current;
    const restoreFocus = () => changeButton.current?.focus();
    element?.addEventListener('close', restoreFocus);
    return () => element?.removeEventListener('close', restoreFocus);
  }, []);

  return <>
    <section aria-label="Selected game mode" className="mode-card mode-current">
      <Artwork mode={selected} />
      <CardContent mode={selected} />
      <div className="mode-footer">
        <span className="mode-meta">{progressLabel(selectedMode, progress)}</span>
        <button ref={changeButton} type="button" aria-haspopup="dialog" onClick={() => { playSound('select', isSoundEnabled); dialog.current?.showModal(); }} className="mode-change">Change <ChevronRight size={17} /></button>
      </div>
    </section>
    {createPortal(<dialog ref={dialog} aria-labelledby="mode-picker-title" className="mode-dialog">
      <header className="mode-dialog-header">
        <div><p className="mode-dialog-kicker">Your next operation</p><h2 id="mode-picker-title">Choose your battlefield</h2></div>
        <button type="button" aria-label="Close mode selection" onClick={() => dialog.current?.close()} className="mode-close"><X size={22} /></button>
      </header>
      <div className="mode-grid">
        {modes.map(mode => (
          <button key={mode.id} type="button" aria-label={`Select ${mode.title}`} aria-pressed={selected.id === mode.id} onClick={() => { onSelectMode(mode.id as ModeId); playSound('select', isSoundEnabled); dialog.current?.close(); }} className={`mode-card mode-option ${selected.id === mode.id ? 'is-selected' : ''}`}>
            <Artwork mode={mode} />
            <CardContent mode={mode} compact />
            <div className="mode-footer"><span className="mode-meta">{progressLabel(mode.id as ModeId, progress)}</span><span className="mode-select">{selected.id === mode.id ? <><Check size={15} /> Selected</> : <>Select <ChevronRight size={16} /></>}</span></div>
          </button>
        ))}
      </div>
      <p className="mode-dialog-hint">Select a card, then launch from the main menu.</p>
    </dialog>, document.body)}
  </>;
}
