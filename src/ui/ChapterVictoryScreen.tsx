import { useEffect, useRef, useState } from 'react';
import { Swords } from 'lucide-react';
import { useResultClickGuard } from './useResultClickGuard';
import './ChapterVictoryScreen.css';

const ARTWORK_SRC = '/images/modes/chapter-1.jpg';
let artwork: HTMLImageElement | undefined;
let artworkReady: Promise<void> | undefined;

/** Fetch and decode once outside the game loop, retaining the decoded image for the result. */
export function preloadChapterVictoryArtwork(): Promise<void> {
  if (!artworkReady) {
    artworkReady = (async () => {
      artwork = new Image();
      artwork.decoding = 'async';
      artwork.fetchPriority = 'low';
      await new Promise<void>((resolve, reject) => {
        artwork!.onload = () => resolve();
        artwork!.onerror = () => reject(new Error('Chapter artwork unavailable'));
        artwork!.src = ARTWORK_SRC;
      });
      await artwork.decode();
    })().catch(() => {
      // The screen still works on its dark fallback if artwork fails; allow a later retry.
      artwork = undefined;
      artworkReady = undefined;
    });
  }
  return artworkReady;
}

export function ChapterVictoryScreen({ title, onMenu, onTryHardMode, onHover }: {
  title: string;
  onMenu: () => void;
  onTryHardMode: () => void;
  onHover: () => void;
}) {
  const menuButton = useRef<HTMLButtonElement>(null);
  const hardModeButton = useRef<HTMLButtonElement>(null);
  const [actionsReady, setActionsReady] = useState(false);
  const resultClickGuard = useResultClickGuard(actionsReady);
  useEffect(() => { void preloadChapterVictoryArtwork(); }, []);
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    // Wait for both button reveals, retaining a brief guard when reduced motion removes them.
    const animations = [menuButton.current, hardModeButton.current]
      .flatMap(button => button?.getAnimations() ?? []);
    void Promise.all([
      new Promise<void>(resolve => { timer = setTimeout(resolve, 600); }),
      ...animations.map(animation => animation.finished.catch(() => {})),
    ]).then(() => {
      if (!cancelled) setActionsReady(true);
    });
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);
  useEffect(() => {
    if (actionsReady) menuButton.current?.focus({ preventScroll: true });
  }, [actionsReady]);

  return <section {...resultClickGuard} className="chapter-victory" role="dialog" aria-modal="true" aria-labelledby="chapter-victory-title">
    <div className="chapter-victory-background" aria-hidden="true">
      <img className="chapter-victory-art" src={ARTWORK_SRC} alt="" decoding="async" draggable={false}
        onError={event => { event.currentTarget.style.visibility = 'hidden'; }} />
      <div className="chapter-victory-shade" />
      <div className="chapter-victory-grid" />
      <div className="chapter-victory-scanlines" />
    </div>
    <div className="chapter-victory-content">
      <div className="chapter-victory-emblem" aria-hidden="true">
        <div className="chapter-victory-halo" />
        <div className="chapter-victory-hexagon" />
      </div>
      <p className="chapter-victory-label">Chapter 1 complete</p>
      <h2 id="chapter-victory-title" className="chapter-victory-title">{title}</h2>
      <button ref={menuButton} className="chapter-victory-action" type="button" disabled={!actionsReady} onMouseEnter={onHover} onClick={onMenu}
        onKeyDown={event => {
          if (event.key === 'Tab' && event.shiftKey) { event.preventDefault(); hardModeButton.current?.focus(); }
        }}>
        <span>Back to Main Menu</span>
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M19 12H5m7-7-7 7 7 7" />
        </svg>
      </button>
      <p className="chapter-victory-challenge-label">Your Next Challenge</p>
      <button ref={hardModeButton} className="chapter-victory-action chapter-victory-hard-mode" type="button" disabled={!actionsReady} onMouseEnter={onHover} onClick={onTryHardMode}
        onKeyDown={event => {
          if (event.key === 'Tab' && !event.shiftKey) { event.preventDefault(); menuButton.current?.focus(); }
        }}>
        <Swords size={20} aria-hidden="true" />
        <span>Try in Hard Mode</span>
      </button>
    </div>
  </section>;
}
