import { useEffect, useRef, useState } from 'react';
import { Check, ChevronRight, X } from 'lucide-react';
import { playSound } from '../audio';

const modes = [
  { id: 'chapter-1', title: 'Chapter 1', subtitle: 'The Helios Breach', description: 'Lead your fleet through five tactical battles. Capture new worlds and push into enemy territory.', background: 'radial-gradient(ellipse at top right, #164e63, transparent 75%)' },
  { id: 'chapter-2', title: 'Chapter 2', subtitle: 'Beyond Helios', description: 'Take the campaign deeper into space. New battlefields and greater challenges await your fleet.', background: 'radial-gradient(ellipse at top right, #312e81, transparent 75%)' },
  { id: 'quick-match', title: 'Quick Match', subtitle: 'One battle. Total conquest.', description: '', background: 'radial-gradient(ellipse at top right, #083344, transparent 75%)' },
];

function CardContent({ mode }: { mode: typeof modes[number] }) {
  return <>
    <h2 className="mb-5 font-mono text-sm uppercase tracking-widest text-cyan-300">{mode.title}</h2>
    {mode.id === 'quick-match' ? (
      <div className="space-y-5 font-mono text-sm text-cyan-100/80">
        <div className="flex items-start gap-4"><span className="font-bold text-cyan-500">01</span><p>Click your <span className="font-bold text-blue-400">BLUE</span> planet to select it, then click a target to attack.</p></div>
        <div className="flex items-start gap-4"><span className="font-bold text-cyan-500">02</span><p>Protect your Capital (the largest planet) at all costs.</p></div>
        <div className="flex items-start gap-4"><span className="font-bold text-cyan-500">03</span><p>Capture 5 planets to unlock the devastating Omni-Strike superweapon.</p></div>
      </div>
    ) : (
      <div className="space-y-4">
        <p className="text-3xl font-bold tracking-tight text-white">{mode.subtitle}</p>
        <p className="font-mono text-sm leading-relaxed text-cyan-100/80">{mode.description}</p>
        <p className="font-mono text-xs uppercase tracking-widest text-cyan-300">Campaign · 5 battles</p>
      </div>
    )}
  </>;
}

export function ModeCard({ isSoundEnabled }: { isSoundEnabled: boolean }) {
  const [selected, setSelected] = useState(modes[0]);
  const dialog = useRef<HTMLDialogElement>(null);
  const changeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const element = dialog.current;
    const restoreFocus = () => changeButton.current?.focus();
    element?.addEventListener('close', restoreFocus);
    return () => element?.removeEventListener('close', restoreFocus);
  }, []);

  return <>
    <section aria-label="Selected game mode" className="relative mt-12 w-full max-w-lg rounded-sm border border-cyan-500/30 bg-cyan-950/40 p-8 pb-20 text-left shadow-[0_0_30px_rgba(6,182,212,0.1)]" style={{ backgroundImage: selected.background }}>
      <CardContent mode={selected} />
      <button ref={changeButton} type="button" aria-haspopup="dialog" onClick={() => { playSound('select', isSoundEnabled); dialog.current?.showModal(); }} className="absolute bottom-4 right-4 flex min-h-11 items-center gap-2 rounded-sm border border-cyan-200 bg-cyan-400 px-5 font-mono text-sm font-bold uppercase tracking-widest text-cyan-950 hover:bg-cyan-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
        Change <ChevronRight size={18} />
      </button>
    </section>
    <dialog ref={dialog} aria-labelledby="mode-picker-title" className="fixed inset-0 m-auto max-h-[90dvh] w-[min(1100px,94vw)] max-w-none overflow-y-auto rounded-sm border border-cyan-500/50 bg-[#050c14] p-5 text-cyan-50 shadow-2xl backdrop:bg-black/85 sm:p-8" style={{ touchAction: 'pan-y' }}>
      <header className="mb-6 flex items-center justify-between gap-4">
        <h2 id="mode-picker-title" className="text-2xl font-bold uppercase tracking-tight">Choose what to play</h2>
        <button type="button" aria-label="Close mode selection" onClick={() => dialog.current?.close()} className="grid size-11 shrink-0 place-items-center border border-cyan-700 text-cyan-200 hover:bg-cyan-900"><X size={22} /></button>
      </header>
      <div className="grid gap-4 md:grid-cols-3">
        {modes.map(mode => (
          <button key={mode.id} type="button" aria-pressed={selected.id === mode.id} onClick={() => { setSelected(mode); playSound('select', isSoundEnabled); dialog.current?.close(); }} className={`relative min-h-80 rounded-sm border p-6 pb-14 text-left transition-colors hover:border-cyan-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 ${selected.id === mode.id ? 'border-cyan-300 bg-cyan-950' : 'border-cyan-800 bg-black/40'}`} style={{ backgroundImage: mode.background }}>
            <CardContent mode={mode} />
            <span className="absolute bottom-5 right-5 flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-cyan-200">{selected.id === mode.id ? <><Check size={16} /> Selected</> : <>Select <ChevronRight size={16} /></>}</span>
          </button>
        ))}
      </div>
    </dialog>
  </>;
}
