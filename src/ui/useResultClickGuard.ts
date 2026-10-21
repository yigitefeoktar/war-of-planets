import { useRef, type MouseEvent } from 'react';

/** A press begun during the reveal must not activate a button when released afterward. */
export function useResultClickGuard(ready: boolean) {
  const pressedWhileReady = useRef(false);
  return {
    onPointerDownCapture: () => { pressedWhileReady.current = ready; },
    onPointerCancelCapture: () => { pressedWhileReady.current = false; },
    onClickCapture: (event: MouseEvent) => {
      // Keyboard and assistive-technology clicks have no pointer press (detail is zero).
      if (!ready || (event.detail > 0 && !pressedWhileReady.current)) {
        event.preventDefault();
        event.stopPropagation();
      }
      pressedWhileReady.current = false;
    },
  };
}
