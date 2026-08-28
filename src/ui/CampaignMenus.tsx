import { useState, type ReactNode } from 'react';
import { ArrowLeft, BookOpen, ChevronRight, LockKeyhole, Play, Settings, Shield, Sparkles, Swords, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { playSound } from '../audio';

type SharedMenuProps = {
  isSoundEnabled: boolean;
};

type ModeSelectionProps = SharedMenuProps & {
  onBack: () => void;
  onCampaign: () => void;
  onQuickMatch: () => void;
};

type CampaignSelectionProps = SharedMenuProps & {
  onBack: () => void;
  onLaunchMission: (missionId: string) => void;
};

type Mission = {
  id: string;
  number: number;
  title: string;
  shortTitle: string;
  briefing: string;
  objective: string;
  duration: string;
  focus: string;
  position: { x: number; y: number };
  available: boolean;
};

const missions: Mission[] = [
  {
    id: 'c1-l1',
    number: 1,
    title: 'First Strike',
    shortTitle: 'First Strike',
    briefing: 'Secure the nearby systems, establish a front line, and break the first enemy capital.',
    objective: 'Destroy the enemy capital.',
    duration: '2–3 min',
    focus: 'Core command',
    position: { x: 11, y: 70 },
    available: true,
  },
  {
    id: 'c1-l2',
    number: 2,
    title: 'The Sleeping Fleet',
    shortTitle: 'Sleeping Fleet',
    briefing: 'An ancient Fleet Vault has awakened between two front lines. Reach it before the enemy.',
    objective: 'Capture the Fleet Vault, then destroy the enemy capital.',
    duration: '3–4 min',
    focus: 'Fleet Vault',
    position: { x: 32, y: 48 },
    available: false,
  },
  {
    id: 'c1-l3',
    number: 3,
    title: 'Orbital Window',
    shortTitle: 'Orbital Window',
    briefing: 'A moving Relay periodically opens a route through the system. Time your advance around the alignment.',
    objective: 'Capture the Relay and use its attack window.',
    duration: '3–4 min',
    focus: 'Orbiting Relay',
    position: { x: 52, y: 27 },
    available: false,
  },
  {
    id: 'c1-l4',
    number: 4,
    title: 'All Systems Forward',
    shortTitle: 'Systems Forward',
    briefing: 'Seize the Command Nexus and direct a sector-wide fleet convergence against one decisive target.',
    objective: 'Capture and activate the Command Nexus.',
    duration: '4–5 min',
    focus: 'Grand Mobilization',
    position: { x: 72, y: 43 },
    available: false,
  },
  {
    id: 'c1-l5',
    number: 5,
    title: 'The Helios Siege',
    shortTitle: 'Helios Siege',
    briefing: 'Every system introduced in the chapter converges in one final assault on the Helios command world.',
    objective: 'Break the Helios defensive network.',
    duration: '6–8 min',
    focus: 'Chapter finale',
    position: { x: 87, y: 17 },
    available: false,
  },
];

function CornerAccents({ color = 'border-cyan-400' }: { color?: string }) {
  return (
    <>
      <span className={`pointer-events-none absolute -left-px -top-px h-4 w-4 border-l-2 border-t-2 ${color}`} />
      <span className={`pointer-events-none absolute -right-px -top-px h-4 w-4 border-r-2 border-t-2 ${color}`} />
      <span className={`pointer-events-none absolute -bottom-px -left-px h-4 w-4 border-b-2 border-l-2 ${color}`} />
      <span className={`pointer-events-none absolute -bottom-px -right-px h-4 w-4 border-b-2 border-r-2 ${color}`} />
    </>
  );
}

function TacticalBackground({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 h-[100dvh] overflow-y-auto bg-[#030305] text-cyan-50 selection:bg-cyan-400/30">
      <div className="pointer-events-none fixed inset-0 opacity-50">
        <motion.div
          animate={{ scale: [1, 1.18, 1], opacity: [0.22, 0.36, 0.22], rotate: [0, 45, 0] }}
          transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
          className="absolute -left-[15%] -top-[20%] h-[70vw] w-[70vw] rounded-full bg-cyan-900/30 blur-[140px]"
        />
        <motion.div
          animate={{ scale: [1, 1.25, 1], opacity: [0.14, 0.28, 0.14], rotate: [0, -45, 0] }}
          transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
          className="absolute -bottom-[25%] -right-[20%] h-[75vw] w-[75vw] rounded-full bg-blue-900/25 blur-[160px]"
        />
      </div>
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(6,182,212,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.045)_1px,transparent_1px)] bg-[size:40px_40px]" />
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.018)_50%,transparent_50%)] bg-[length:100%_4px]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_center,transparent_15%,#030305_125%)]" />
      <div className="relative z-10 mx-auto flex min-h-full w-full max-w-7xl flex-col px-4 py-5 sm:px-6 sm:py-7 lg:px-10 lg:py-9">
        {children}
      </div>
    </div>
  );
}

function Telemetry() {
  return (
    <div className="hidden text-right font-mono text-[10px] leading-relaxed tracking-[0.18em] text-cyan-500/55 sm:block">
      SYS.VER_10.0<br />
      PROFILE: COMMANDER<br />
      UPLINK: <span className="text-emerald-400/80">SECURE</span>
    </div>
  );
}

function Header({ kicker, title, children }: { kicker: string; title: string; children?: ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-5 border-b border-cyan-500/20 pb-5">
      <div>
        {children}
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.24em] text-cyan-400 sm:text-xs">{kicker}</p>
        <h1 className="text-3xl font-black uppercase tracking-[-0.045em] text-transparent bg-clip-text bg-gradient-to-b from-white to-cyan-300 sm:text-5xl lg:text-6xl">
          {title}
        </h1>
      </div>
      <Telemetry />
    </header>
  );
}

function ModeCard({
  index,
  title,
  copy,
  action,
  icon,
  featured = false,
  onClick,
  onHover,
}: {
  index: string;
  title: string;
  copy: string;
  action: string;
  icon: ReactNode;
  featured?: boolean;
  onClick: () => void;
  onHover: () => void;
}) {
  return (
    <motion.button
      type="button"
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.985 }}
      onMouseEnter={onHover}
      onFocus={onHover}
      onClick={onClick}
      className={`group relative flex min-h-64 flex-col overflow-hidden border p-6 text-left transition-colors sm:min-h-80 sm:p-8 ${
        featured
          ? 'border-cyan-400/70 bg-[radial-gradient(circle_at_82%_18%,rgba(34,211,238,0.2),transparent_36%),linear-gradient(145deg,rgba(8,51,65,0.92),rgba(3,14,20,0.96))] shadow-[0_0_35px_rgba(6,182,212,0.12)] hover:border-cyan-300'
          : 'border-cyan-800/60 bg-[linear-gradient(145deg,rgba(7,32,42,0.88),rgba(3,12,18,0.96))] hover:border-cyan-500/70'
      }`}
    >
      <CornerAccents color={featured ? 'border-cyan-300' : 'border-cyan-700'} />
      <div className="flex w-full items-start justify-between gap-4">
        <span className="text-6xl font-black leading-none tracking-tighter text-cyan-300/20 sm:text-7xl">{index}</span>
        <span className={`grid h-11 w-11 place-items-center border ${featured ? 'border-cyan-400/50 bg-cyan-400/10 text-cyan-200' : 'border-cyan-800/60 bg-cyan-950/40 text-cyan-500/70'}`}>
          {icon}
        </span>
      </div>
      <div className="mt-auto pt-8">
        <h2 className="mb-3 text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">{title}</h2>
        <p className="mb-6 max-w-xl font-mono text-xs leading-relaxed text-cyan-100/55 sm:text-sm">{copy}</p>
        <span className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">
          {action}
          <ChevronRight size={16} className="transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </motion.button>
  );
}

export function ModeSelection({ isSoundEnabled, onBack, onCampaign, onQuickMatch }: ModeSelectionProps) {
  const hover = () => playSound('hover', isSoundEnabled);
  const choose = (action: () => void) => {
    playSound('select', isSoundEnabled);
    action();
  };

  return (
    <TacticalBackground>
      <Header kicker="Command interface / operation select" title="Choose Your War" />

      <main className="grid flex-1 content-center gap-4 py-7 lg:grid-cols-[1.15fr_0.85fr] lg:gap-5 lg:py-10">
        <ModeCard
          index="01"
          title="Campaign"
          copy="Fight through authored tactical missions. New battlefield rules, special planets, and command weapons arrive quickly."
          action="Enter campaign"
          icon={<BookOpen size={22} />}
          featured
          onHover={hover}
          onClick={() => choose(onCampaign)}
        />
        <ModeCard
          index="02"
          title="Quick Match"
          copy="Launch the classic four-faction war immediately with your current sound and difficulty settings."
          action="Instant launch"
          icon={<Swords size={22} />}
          onHover={hover}
          onClick={() => choose(onQuickMatch)}
        />
      </main>

      <footer className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-cyan-500/15 pt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-600/70 sm:justify-between">
        <button
          type="button"
          onMouseEnter={hover}
          onClick={() => choose(onBack)}
          className="flex min-h-11 items-center gap-2 px-2 transition-colors hover:text-cyan-300"
        >
          <ArrowLeft size={14} /> Command entry
        </button>
        <div className="flex items-center gap-5">
          <span className="flex items-center gap-2"><Settings size={13} /> Settings retained</span>
          <span className="hidden items-center gap-2 sm:flex"><Shield size={13} /> Local profile</span>
        </div>
      </footer>
    </TacticalBackground>
  );
}

function MissionMap({
  selectedMission,
  onSelectMission,
  isSoundEnabled,
}: {
  selectedMission: Mission;
  onSelectMission: (mission: Mission) => void;
  isSoundEnabled: boolean;
}) {
  return (
    <div className="relative min-h-[390px] overflow-hidden border border-cyan-700/35 bg-black/35 sm:min-h-[460px]">
      <CornerAccents color="border-cyan-500/70" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.09),transparent_52%)]" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[54%] w-[72%] -translate-x-1/2 -translate-y-1/2 -rotate-6 rounded-[50%] border border-cyan-600/15" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[34%] w-[47%] -translate-x-1/2 -translate-y-1/2 rotate-12 rounded-[50%] border border-cyan-600/10" />

      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="active-route" x1="0" x2="1">
            <stop offset="0" stopColor="rgba(34,211,238,0.7)" />
            <stop offset="1" stopColor="rgba(34,211,238,0.2)" />
          </linearGradient>
        </defs>
        <polyline points="14,73 35,51 55,30 75,46 90,20" fill="none" stroke="rgba(34,211,238,0.18)" strokeWidth="0.45" vectorEffect="non-scaling-stroke" />
        <polyline points="14,73 35,51" fill="none" stroke="url(#active-route)" strokeWidth="0.7" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
      </svg>

      <div className="absolute left-5 top-5 font-mono text-[9px] uppercase tracking-[0.18em] text-cyan-600/60 sm:text-[10px]">
        Helios tactical sector<br />Route projection: partial
      </div>

      {missions.map((mission) => {
        const isSelected = selectedMission.id === mission.id;
        return (
          <button
            key={mission.id}
            type="button"
            aria-pressed={isSelected}
            aria-label={`Mission ${mission.number}: ${mission.title}${mission.available ? ', available' : ', locked preview'}`}
            onMouseEnter={() => playSound('hover', isSoundEnabled)}
            onClick={() => {
              playSound(mission.available ? 'select' : 'click', isSoundEnabled);
              onSelectMission(mission);
            }}
            className="group absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${mission.position.x}%`, top: `${mission.position.y}%` }}
          >
            <span
              className={`relative mx-auto grid h-12 w-12 place-items-center rounded-full border font-mono text-xs font-black transition-all sm:h-14 sm:w-14 ${
                isSelected
                  ? 'border-white bg-cyan-400 text-[#031015] shadow-[0_0_28px_rgba(34,211,238,0.6)]'
                  : mission.available
                    ? 'animate-pulse border-cyan-300 bg-cyan-950 text-cyan-100 shadow-[0_0_22px_rgba(34,211,238,0.3)] group-hover:bg-cyan-900'
                    : 'border-cyan-900/70 bg-[#071016] text-cyan-700 group-hover:border-cyan-600 group-hover:text-cyan-400'
              }`}
            >
              {mission.available ? String(mission.number).padStart(2, '0') : <LockKeyhole size={15} />}
            </span>
            <span className={`absolute left-1/2 top-[58px] w-24 -translate-x-1/2 font-mono text-[9px] uppercase leading-tight tracking-[0.08em] sm:top-[66px] sm:w-32 sm:text-[10px] ${isSelected ? 'text-cyan-100' : 'text-cyan-600/70'}`}>
              {mission.shortTitle}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function CampaignSelection({ isSoundEnabled, onBack, onLaunchMission }: CampaignSelectionProps) {
  const [selectedMission, setSelectedMission] = useState(missions[0]);
  const hover = () => playSound('hover', isSoundEnabled);

  return (
    <TacticalBackground>
      <Header kicker="Campaign / Chapter 01" title="The Helios Breach">
        <button
          type="button"
          onMouseEnter={hover}
          onClick={() => {
            playSound('click', isSoundEnabled);
            onBack();
          }}
          className="mb-3 flex min-h-10 items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-600 transition-colors hover:text-cyan-300"
        >
          <ArrowLeft size={14} /> Operation select
        </button>
      </Header>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Campaign chapters">
        <button
          type="button"
          role="tab"
          aria-selected="true"
          className="min-h-11 shrink-0 border border-cyan-400 bg-cyan-950/70 px-4 font-mono text-[10px] uppercase tracking-[0.12em] text-cyan-100"
        >
          01 Helios Breach
        </button>
        {['02 Signal War', '03 Final Horizon'].map((chapter) => (
          <button
            key={chapter}
            type="button"
            role="tab"
            aria-selected="false"
            disabled
            className="flex min-h-11 shrink-0 cursor-not-allowed items-center gap-2 border border-cyan-950 bg-black/25 px-4 font-mono text-[10px] uppercase tracking-[0.12em] text-cyan-900"
          >
            <LockKeyhole size={12} /> {chapter}
          </button>
        ))}
      </div>

      <div className="mb-4 flex items-center gap-3 font-mono text-[9px] uppercase tracking-[0.14em] text-cyan-700 sm:text-[10px]">
        <span className="shrink-0">Chapter progress</span>
        <span className="h-1 flex-1 overflow-hidden bg-cyan-950"><span className="block h-full w-[4%] bg-cyan-400" /></span>
        <span className="shrink-0">0 / 5</span>
      </div>

      <main className="grid flex-1 gap-4 pb-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(310px,0.6fr)] lg:gap-5">
        <MissionMap
          selectedMission={selectedMission}
          onSelectMission={setSelectedMission}
          isSoundEnabled={isSoundEnabled}
        />

        <motion.aside
          key={selectedMission.id}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.18 }}
          className="relative flex min-h-80 flex-col border border-cyan-600/40 bg-cyan-950/35 p-5 backdrop-blur-md sm:p-6"
        >
          <CornerAccents color={selectedMission.available ? 'border-cyan-300' : 'border-cyan-800'} />
          <div className="mb-4 flex items-center justify-between gap-3 font-mono text-[9px] uppercase tracking-[0.16em] sm:text-[10px]">
            <span className={selectedMission.available ? 'text-cyan-300' : 'text-cyan-700'}>
              Mission {String(selectedMission.number).padStart(2, '0')} / {selectedMission.available ? 'Available' : 'Encrypted'}
            </span>
            {selectedMission.available ? <Sparkles size={14} className="text-cyan-300" /> : <LockKeyhole size={14} className="text-cyan-800" />}
          </div>

          <h2 className="mb-3 text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">{selectedMission.title}</h2>
          <p className="font-mono text-xs leading-relaxed text-cyan-100/55">{selectedMission.briefing}</p>

          <div className="my-5 border-y border-cyan-700/25 py-4">
            <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.16em] text-cyan-400">Primary objective</p>
            <p className="mb-0 font-mono text-xs leading-relaxed text-cyan-100/70">{selectedMission.objective}</p>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3 font-mono text-[9px] uppercase tracking-[0.1em] text-cyan-700 sm:text-[10px]">
            <div><span className="mb-1 block text-cyan-400/70">Est. duration</span>{selectedMission.duration}</div>
            <div><span className="mb-1 block text-cyan-400/70">Tactical focus</span>{selectedMission.focus}</div>
          </div>

          <button
            type="button"
            disabled={!selectedMission.available}
            onMouseEnter={selectedMission.available ? hover : undefined}
            onClick={() => {
              if (!selectedMission.available) return;
              playSound('select', isSoundEnabled);
              onLaunchMission(selectedMission.id);
            }}
            className={`mt-auto flex min-h-12 w-full items-center justify-center gap-3 border px-4 font-mono text-xs font-black uppercase tracking-[0.14em] transition-all ${
              selectedMission.available
                ? 'border-cyan-200 bg-cyan-400 text-[#031015] shadow-[0_0_20px_rgba(34,211,238,0.2)] hover:bg-cyan-200 hover:shadow-[0_0_30px_rgba(34,211,238,0.35)]'
                : 'cursor-not-allowed border-cyan-950 bg-black/30 text-cyan-900'
            }`}
          >
            {selectedMission.available ? <><Play size={15} fill="currentColor" /> Launch mission</> : <><LockKeyhole size={14} /> Complete previous operation</>}
          </button>
        </motion.aside>
      </main>

      <footer className="flex items-center justify-between border-t border-cyan-500/15 pt-4 font-mono text-[9px] uppercase tracking-[0.13em] text-cyan-700 sm:text-[10px]">
        <span className="flex items-center gap-2"><Zap size={12} /> New systems introduced every mission</span>
        <span className="hidden sm:inline">Sector: Helios / Threat: Elevated</span>
      </footer>
    </TacticalBackground>
  );
}
