/** Keep native/programmatic focus useful without drawing rings after a tap. */
export function installInputFeedback() {
  const root = document.documentElement;
  root.dataset.inputModality = 'pointer';

  const rememberPointer = (event: PointerEvent) => {
    root.toggleAttribute('data-touch-input', event.pointerType === 'touch');
  };
  const onPointerDown = (event: PointerEvent) => {
    rememberPointer(event);
    root.dataset.inputModality = 'pointer';
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing ||
      ['Alt', 'Control', 'Meta', 'Shift'].includes(event.key)) return;
    root.dataset.inputModality = 'keyboard';
  };

  // Capture before a button opens a dialog or the browser moves focus.
  document.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });
  document.addEventListener('pointerover', rememberPointer, { capture: true, passive: true });
  document.addEventListener('keydown', onKeyDown, true);
  return () => {
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('pointerover', rememberPointer, true);
    document.removeEventListener('keydown', onKeyDown, true);
  };
}
