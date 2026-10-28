import { Skull } from 'lucide-react';
import { playSound } from '../audio';

type HardModeButtonProps = {
  isHardMode: boolean;
  setIsHardMode: (value: boolean) => void;
  isSoundEnabled: boolean;
  compact?: boolean;
};

export function HardModeButton({ isHardMode, setIsHardMode, isSoundEnabled, compact = false }: HardModeButtonProps) {
  const label = isHardMode ? 'Hard Mode: On' : 'Hard Mode: Off';
  return (
    <button
      type="button"
      aria-pressed={isHardMode}
      aria-label={compact ? label : undefined}
      title={compact ? label : undefined}
      onMouseEnter={() => playSound('hover', isSoundEnabled)}
      onClick={() => {
        const newState = !isHardMode;
        setIsHardMode(newState);
        if (newState) playSound('click', isSoundEnabled);
      }}
      className={`flex items-center ${compact ? 'h-11 w-11 shrink-0 justify-center' : 'gap-2 px-4 py-2'} border transition-all rounded-sm font-mono text-xs tracking-widest uppercase group ${
        isHardMode
          ? 'bg-red-900/30 border-red-500/50 text-red-400'
          : 'bg-cyan-950/40 border-cyan-500/30 text-cyan-500/60 hover:text-cyan-400 hover:border-cyan-400/50 hover:bg-cyan-900/30'
      }`}
    >
      <Skull size={compact ? 22 : 14} className={`group-hover:scale-110 transition-transform ${!isHardMode && 'opacity-50'}`} />
      {!compact && label}
    </button>
  );
}
