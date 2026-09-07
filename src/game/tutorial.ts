import { NEUTRAL, PLAYER } from './campaign';
import type { Base } from './types';

export const TUTORIAL_ACCENT = '#73dcff'; // Existing Chapter 1 card accent.
export const TUTORIAL_PULSE_MS = 700;
export const TUTORIAL_ZOOM_DELAY_MS = 4000;
export type TutorialState = { step: 'select' | 'attack' | 'watch' | 'zoom' | 'capitals' | 'done'; showZoomLesson?: boolean; zoomStart?: number; zoomGoal?: number; zoomReadyAt?: number; zoomCompleted?: boolean };
export type TutorialEvent =
  | { type: 'selection'; playerSelected: boolean }
  | { type: 'launch'; hostile: boolean; zoom: number; overviewZoom?: number; now?: number }
  | { type: 'tick'; now: number }
  | { type: 'zoom'; before: number; after: number }
  | { type: 'dismiss' };

export function advanceTutorial(state: TutorialState, event: TutorialEvent): TutorialState {
  if (state.step === 'done') return state;
  if (event.type === 'dismiss') return { step: 'done' };
  if (event.type === 'selection' && (state.step === 'select' || state.step === 'attack')) {
    const step = event.playerSelected ? 'attack' : 'select';
    return step === state.step ? state : { ...state, step };
  }
  if (event.type === 'launch' && event.hostile && (state.step === 'select' || state.step === 'attack')) return { ...state, step: 'watch', zoomStart: event.zoom, zoomGoal: Math.max(0.1, Math.min(event.zoom * 0.9, event.overviewZoom ?? event.zoom * 0.9)), zoomReadyAt: (event.now ?? 0) + TUTORIAL_ZOOM_DELAY_MS };
  if (event.type === 'tick' && state.step === 'watch' && event.now >= state.zoomReadyAt!) return { ...state, step: state.showZoomLesson === false || state.zoomCompleted ? 'capitals' : 'zoom' };
  // Only an actual user zoom-out counts, never the automatic camera intro.
  // Remember an early zoom without interrupting the post-launch breathing room.
  if (event.type === 'zoom' && state.step === 'watch' && !state.zoomCompleted && event.after < event.before && event.after <= state.zoomGoal!) return { ...state, zoomCompleted: true };
  if (event.type === 'zoom' && state.step === 'zoom' && event.after < event.before && event.after <= (state.zoomGoal ?? state.zoomStart! * 0.9)) return { step: 'capitals' };
  return state;
}

export function tutorialTargets(state: TutorialState, bases: readonly Base[], selectedId: string | null, preferredId: string | undefined, attackRange: number): Base[] {
  if (state.step === 'select') return bases.filter(p => p.color === PLAYER && p.isCapital);
  if (state.step === 'capitals') return bases.filter(p => p.isCapital && p.color !== PLAYER && p.color !== NEUTRAL);
  if (state.step !== 'attack') return [];
  const source = bases.find(p => p.id === selectedId && p.color === PLAYER);
  if (!source) return [];
  const targets = bases.filter(p => p.color !== PLAYER && Math.hypot(p.x - source.x, p.y - source.y) <= attackRange);
  const preferred = targets.find(p => p.id === preferredId);
  return preferred ? [preferred] : targets.filter(p => p.color !== NEUTRAL).slice(0, 1);
}

export function drawTutorialHighlights(ctx: CanvasRenderingContext2D, targets: readonly Base[], zoom: number, time: number) {
  ctx.save();
  ctx.strokeStyle = TUTORIAL_ACCENT;
  ctx.shadowColor = TUTORIAL_ACCENT;
  ctx.shadowBlur = 12;
  ctx.lineWidth = 3 / zoom;
  const pulse = (Math.sin(time * Math.PI * 2 / TUTORIAL_PULSE_MS) + 1) / 2;
  for (const base of targets) {
    const radius = (base.isCapital ? 40 : 20) + 15 + Math.sqrt(base.pixelCount) * 5 + (8 + pulse * 12) / zoom;
    ctx.globalAlpha = 0.65 + pulse * 0.35;
    ctx.beginPath();
    ctx.arc(base.x, base.y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}
