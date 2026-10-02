import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronRight, Layers, Skull, Swords, X } from 'lucide-react';
import { playSound } from '../audio';
import './ModeCard.css';
import { CHAPTERS, CHAPTER_ONE_TEST_MODE_IDS, isChapterOneTestMode, progressLabel, type ModeId, type Progress } from '../game/campaign';

type Mode = { id: ModeId; title: string; subtitle: string; description: string; accent: string; rgb: string; label: string };

const mainModes: Mode[] = [
  { id: 'chapter-1', title: 'Chapter 1', subtitle: 'The Helios Breach', description: 'Lead your fleet through five tactical battles. Capture new worlds and push into enemy territory.', accent: '#73dcff', rgb: '115, 220, 255', label: 'Campaign · 5 battles' },
  { id: 'quick-match', title: 'Quick Match', subtitle: 'One battle. Total conquest.', description: 'Command your fleet. Defend your capital. Conquer the system.', accent: '#ffc184', rgb: '255, 193, 132', label: 'Instant action' },
  { id: 'hard-mode', title: 'Hard Mode', subtitle: 'A tougher conquest.', description: 'Take on a Quick Match against a more aggressive AI. Defend your capital and conquer the system.', accent: '#f87171', rgb: '248, 113, 113', label: 'Hard AI' },
];
const testModes: Mode[] = CHAPTER_ONE_TEST_MODE_IDS.map((id, index) => ({
  id, title: 'Chapter 1 Test', subtitle: `Level ${index + 1}: ${CHAPTERS[id].maps[0].title}`,
  description: index === CHAPTER_ONE_TEST_MODE_IDS.length - 1
    ? 'Start directly at the Chapter 1 finale. Test wins do not change campaign progress.'
    : `Start directly at Level ${index + 1}. Wins continue through later Chapter 1 levels without changing campaign progress.`,
  accent: '#73dcff', rgb: '115, 220, 255', label: 'Testing',
}));
const modes = [...mainModes, ...testModes];

function Artwork({ mode }: { mode: Mode }) {
  return <>{!isChapterOneTestMode(mode.id) && <img className="mode-art" src={`/images/modes/${mode.id}.jpg`} alt="" draggable={false} />}<span className="mode-shade" /></>;
}

function CardContent({ mode, compact = false }: { mode: Mode; compact?: boolean }) {
  return <>
    <span className="mode-eyebrow">{mode.id === 'hard-mode' ? <Skull size={13} /> : mode.id === 'quick-match' ? <Swords size={13} /> : <Layers size={13} />}{mode.title}</span>
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

export function ModeCard({ isSoundEnabled, selectedMode, onSelectMode, progress }: { isSoundEnabled: boolean; selectedMode: ModeId; onSelectMode: (mode: ModeId) => void; progress: Progress }) {
  const selected = modes.find(mode => mode.id === selectedMode) ?? modes[0];
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
    <section aria-label="Selected game mode" className={`mode-card mode-current ${selected.id === 'hard-mode' ? 'mode-hard' : ''}`}>
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
        {mainModes.map(mode => (
          <button key={mode.id} type="button" aria-label={`Select ${mode.title}`} aria-pressed={selected.id === mode.id} onClick={() => { onSelectMode(mode.id); playSound('select', isSoundEnabled); dialog.current?.close(); }} className={`mode-card mode-option ${mode.id === 'hard-mode' ? 'mode-hard' : ''} ${selected.id === mode.id ? 'is-selected' : ''}`}>
            <Artwork mode={mode} />
            <CardContent mode={mode} compact />
            <div className="mode-footer"><span className="mode-meta">{progressLabel(mode.id, progress)}</span><span className="mode-select">{selected.id === mode.id ? <><Check size={15} /> Selected</> : <>Select <ChevronRight size={16} /></>}</span></div>
          </button>
        ))}
      </div>
      <section className="mode-test-section" aria-label="Chapter 1 level tests">
        <p className="mode-test-heading">Start Chapter 1 at any level</p>
        <div className="mode-test-grid">
          {testModes.map((mode, index) => {
            const mapTitle = CHAPTERS[CHAPTER_ONE_TEST_MODE_IDS[index]].maps[0].title;
            return <button key={mode.id} type="button" aria-label={`Select Level ${index + 1} test: ${mapTitle}`} aria-pressed={selected.id === mode.id} onClick={() => { onSelectMode(mode.id); playSound('select', isSoundEnabled); dialog.current?.close(); }} className={`mode-test-option ${selected.id === mode.id ? 'is-selected' : ''}`}>
              <span>Level {index + 1} Test <small>{mapTitle}</small></span>
              <span>{selected.id === mode.id ? 'Selected' : 'Select'} <ChevronRight size={16} /></span>
            </button>;
          })}
        </div>
      </section>
      <p className="mode-dialog-hint">Select a mode, then launch from the main menu.</p>
    </dialog>, document.body)}
  </>;
}
