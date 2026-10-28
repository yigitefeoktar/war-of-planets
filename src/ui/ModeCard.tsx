import { Fragment, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronRight, Layers, Orbit, SlidersHorizontal, Swords, Users, X } from 'lucide-react';
import { playSound } from '../audio';
import './ModeCard.css';
import { HardModeButton } from './HardModeButton';
import { CHAPTERS, CHAPTER_ONE_TEST_MODE_IDS, CHAPTER_TWO_TEST_MODE_IDS, isChapterTestMode, progressLabel, type ModeId, type Progress } from '../game/campaign';

type Mode = { id: ModeId; title: string; subtitle: string; description: string; accent: string; rgb: string; label: string };

const mainModes: Mode[] = [
  { id: 'chapter-1', title: 'Chapter 1', subtitle: 'The Helios Breach', description: 'Lead your fleet through five tactical battles. Capture new worlds and push into enemy territory.', accent: '#73dcff', rgb: '115, 220, 255', label: 'Campaign · 5 battles' },
  { id: 'chapter-2', title: 'Chapter 2', subtitle: 'The Fractured Galaxy', description: 'Steal enemy worlds with Conversion Probes. Confront pink factories across five expanding battlefields.', accent: '#ff8fc7', rgb: '255, 143, 199', label: 'Campaign · 5 battles' },
  { id: 'quick-match', title: 'Quick Match', subtitle: 'One battle. Total conquest.', description: 'A new balanced battlefield every time. Choose your expansion routes, defend your capital and conquer the system.', accent: '#ffc184', rgb: '255, 193, 132', label: 'Balanced random maps' },
  { id: 'chaos-mode', title: 'Chaos Mode', subtitle: 'A galaxy in motion.', description: 'Every planet orbits a star and produces one or two superweapons. Ride shifting routes and fight for a galaxy packed with power.', accent: '#a78bfa', rgb: '167, 139, 250', label: 'Orbiting weapon worlds' },
  { id: 'custom-map', title: 'Create Your Own Map', subtitle: 'Your battlefield. Your rules.', description: 'Choose your layout, shape the systems and set your starting conditions. Preview your own battlefield, then launch your conquest.', accent: '#6ee7a0', rgb: '110, 231, 160', label: 'Build your battlefield' },
];
const testSections = [
  { chapter: 'Chapter 1', ids: CHAPTER_ONE_TEST_MODE_IDS, accent: '#73dcff', rgb: '115, 220, 255' },
  { chapter: 'Chapter 2', ids: CHAPTER_TWO_TEST_MODE_IDS, accent: '#ff8fc7', rgb: '255, 143, 199' },
];
const testModes: Mode[] = testSections.flatMap(({ chapter, ids, accent, rgb }) => ids.map((id, index) => ({
  id, title: `${chapter} Test`, subtitle: `Level ${index + 1}: ${CHAPTERS[id].maps[0].title}`,
  description: index === ids.length - 1
    ? `Start directly at the ${chapter} finale. Test wins do not change campaign progress.`
    : `Start directly at Level ${index + 1}. Wins continue through later ${chapter} levels without changing campaign progress.`,
  accent, rgb, label: 'Testing',
})));
const modes = [...mainModes, ...testModes];

function Artwork({ mode }: { mode: Mode }) {
  return <>{!isChapterTestMode(mode.id) && <img className="mode-art" src={`/images/modes/${mode.id === 'custom-map' ? 'custom-map-green' : mode.id === 'chaos-mode' ? 'hard-mode' : mode.id === 'chapter-2' ? 'chapter-1' : mode.id}.jpg`} alt="" draggable={false} />}<span className="mode-shade" /></>;
}

function CardContent({ mode, compact = false }: { mode: Mode; compact?: boolean }) {
  return <>
    <span className="mode-eyebrow">{mode.id === 'custom-map' ? <SlidersHorizontal size={13} /> : mode.id === 'chaos-mode' ? <Orbit size={13} /> : mode.id === 'quick-match' ? <Swords size={13} /> : <Layers size={13} />}{mode.title}</span>
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
  const selected = modes.find(mode => mode.id === selectedMode) ?? modes[0];
  const dialog = useRef<HTMLDialogElement>(null);
  const changeButton = useRef<HTMLButtonElement>(null);
  const pointerInteraction = useRef(false);

  useEffect(() => {
    const element = dialog.current;
    // Native dialog focus can scroll the menu's otherwise hidden containers.
    const menuPositions: { element: HTMLElement; top: number; left: number }[] = [];
    for (let parent = changeButton.current?.parentElement; parent; parent = parent.parentElement) {
      menuPositions.push({ element: parent, top: parent.scrollTop, left: parent.scrollLeft });
    }
    const restoreFocus = () => {
      // Dialogs can carry their autofocus ring back to the trigger after a tap.
      // Restore keyboard focus, but leave pointer interactions without a ring.
      if (pointerInteraction.current) changeButton.current?.blur();
      else changeButton.current?.focus({ preventScroll: true });
      for (const position of menuPositions) {
        position.element.scrollTop = position.top;
        position.element.scrollLeft = position.left;
      }
    };
    element?.addEventListener('close', restoreFocus);
    return () => element?.removeEventListener('close', restoreFocus);
  }, []);

  return <>
    <section aria-label="Selected game mode" className={`mode-card mode-current ${selected.id === 'custom-map' ? 'mode-custom' : selected.id === 'quick-match' ? 'mode-quick' : selected.id === 'chaos-mode' ? 'mode-chaos' : selected.id.startsWith('chapter-2') ? 'mode-frontier' : ''}`}>
      <Artwork mode={selected} />
      <CardContent mode={selected} />
      <div className="mode-footer">
        <span className="mode-meta">{progressLabel(selectedMode, progress)}</span>
        <button ref={changeButton} type="button" aria-haspopup="dialog" onPointerDown={() => { pointerInteraction.current = true; }} onKeyDown={() => { pointerInteraction.current = false; }} onClick={() => { playSound('select', isSoundEnabled); dialog.current?.showModal(); }} className="mode-change">Change <ChevronRight size={17} /></button>
      </div>
    </section>
    {createPortal(<dialog ref={dialog} aria-labelledby="mode-picker-title" className="mode-dialog" onPointerDownCapture={() => { pointerInteraction.current = true; }} onKeyDownCapture={() => { pointerInteraction.current = false; }}>
      <div className="mode-dialog-panel">
        <div className="mode-dialog-scroll">
        <header className="mode-dialog-header">
          <div><p className="mode-dialog-kicker">Your next operation</p><h2 id="mode-picker-title">Choose your battlefield</h2></div>
          <div className="mode-dialog-actions">
            <button type="button" aria-label="Close mode selection" onClick={() => dialog.current?.close()} className="mode-close"><X size={22} /></button>
            <HardModeButton isHardMode={isHardMode} setIsHardMode={setIsHardMode} isSoundEnabled={isSoundEnabled} compact />
          </div>
        </header>
        <div className="mode-grid">
          {mainModes.map(mode => <Fragment key={mode.id}>
            {mode.id === 'quick-match' && <button type="button" disabled aria-label="Multiplayer — Coming Soon" className="mode-card mode-option mode-coming-soon">
              <img className="mode-art" src="/images/modes/quick-match.jpg" alt="" draggable={false} />
              <span className="mode-shade" />
              <span className="mode-eyebrow"><Users size={13} />Multiplayer</span>
              <div className="mode-copy"><h2>Coming Soon</h2><p>Multiplayer battles are coming soon.</p></div>
              <div className="mode-footer"><span className="mode-meta">Not available yet</span><span className="mode-select">Coming Soon</span></div>
            </button>}
            <button type="button" aria-label={`Select ${mode.title}`} aria-pressed={selected.id === mode.id} onClick={() => { onSelectMode(mode.id); playSound('select', isSoundEnabled); dialog.current?.close(); }} className={`mode-card mode-option ${mode.id === 'custom-map' ? 'mode-custom' : mode.id === 'quick-match' ? 'mode-quick' : mode.id === 'chaos-mode' ? 'mode-chaos' : mode.id === 'chapter-2' ? 'mode-frontier' : ''} ${selected.id === mode.id ? 'is-selected' : ''}`}>
              <Artwork mode={mode} />
              <CardContent mode={mode} compact />
              <div className="mode-footer"><span className="mode-meta">{progressLabel(mode.id, progress)}</span><span className="mode-select">{selected.id === mode.id ? <><Check size={15} /> Selected</> : <>Select <ChevronRight size={16} /></>}</span></div>
            </button>
          </Fragment>)}
        </div>
        {testSections.map(({ chapter, ids }) => <section key={chapter} className="mode-test-section" aria-label={`${chapter} level tests`}>
          <p className="mode-test-heading">Start {chapter} at any level</p>
          <div className="mode-test-grid">
            {ids.map((id, index) => {
              const mapTitle = CHAPTERS[id].maps[0].title;
              const label = chapter === 'Chapter 1' ? `Select Level ${index + 1} test: ${mapTitle}` : `Select Chapter 2 Level ${index + 1} test: ${mapTitle}`;
              return <button key={id} type="button" aria-label={label} aria-pressed={selected.id === id}
                onClick={() => { onSelectMode(id); playSound('select', isSoundEnabled); dialog.current?.close(); }}
                className={`mode-test-option ${selected.id === id ? 'is-selected' : ''}`}>
                <span>Level {index + 1} Test <small>{mapTitle}</small></span>
                <span>{selected.id === id ? 'Selected' : 'Select'} <ChevronRight size={16} /></span>
              </button>;
            })}
          </div>
        </section>)}
        <p className="mode-dialog-hint">Select a mode, then launch from the main menu.</p>
        </div>
      </div>
    </dialog>, document.body)}
  </>;
}
