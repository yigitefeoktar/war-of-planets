import { useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, ArrowRight, Bookmark, BookmarkCheck, Check, ChevronDown, ChevronRight, Expand, Orbit, RotateCcw, Shield, Shuffle, SlidersHorizontal, Swords, X } from 'lucide-react';
import type { MapDefinition } from '../game/campaign';
import { createCustomMap, newCustomMapRoll, normalizeCustomMap, resolveCustomMapSettings, type CustomMapRandomSetting, type CustomMapSettings } from '../game/customMaps';
import { playSound } from '../audio';
import { LayoutThumbnail, MapPreview } from './MapPreview';
import { QUICK_BATTLE_PLANS, QUICK_ROUTE_VARIANTS, quickRouteVariant } from '../game/quickMapGenerator';
import './CustomMapSetup.css';

const QUICK_LABELS = ['Crossroads', 'Twin Fronts', 'Outer Arsenals', 'Linked Arenas'];
const CHAOS_LABELS = ['Stellar Bend', 'Branching Fronts', 'Orbital Circuit', 'Wide Fronts'];
const COMPOSITIONS = ['Four classic systems', 'Four normal systems', 'Mixed systems', 'Two large + two small'];
const COMPOSITION_HINTS = ['4 classic · 48 worlds', '4 normal · 48 worlds', '1 large · 2 normal · 1 small', '2 large · 2 small'];
const FORMATION_LABELS = { classic: 'Classic rings', scattered: 'Scattered', 'pentagon-web': 'Pentagon web' };
const WEAPON_LABELS = { balanced: 'Balanced', production: 'Production Overdrive', defense: 'Repulse Shield', strike: 'Omni Strike' };
const DEFENDER_LABELS = { light: 'Light', standard: 'Standard', fortified: 'Fortified' };
type RandomChoice = { selected: boolean; onSelect: () => void };

function Choices<T extends string | number>({ label, value, options, onChange, hint, random }: { label: string; value: T; options: { value: T; label: string; disabled?: boolean }[]; onChange: (value: T) => void; hint?: string; random?: RandomChoice }) {
  const id = useId();
  return <fieldset className="map-setting map-choice-setting">
    <legend>{label}</legend>
    <div className="map-choice-group">{options.map(option => <label key={option.value} className={`map-choice ${option.disabled ? 'is-disabled' : ''}`}>
      <input type="radio" name={id} value={option.value} checked={!random?.selected && value === option.value} disabled={option.disabled} onChange={() => onChange(option.value)} />
      <span>{option.label}</span>
    </label>)}{random && <label className="map-choice map-choice-random"><input type="radio" name={id} value="random" checked={random.selected} onChange={random.onSelect} /><span><Shuffle size={12} aria-hidden="true" /> Random</span></label>}</div>
    {hint && <p className="map-setting-hint">{hint}</p>}
  </fieldset>;
}

function SelectSetting({ label, value, onChange, children, hint, random }: { label: string; value: string | number; onChange: (value: string) => void; children: ReactNode; hint?: string; random?: RandomChoice }) {
  const id = useId();
  return <div className="map-setting map-select-setting"><label htmlFor={id}>{label}</label><div className="map-select-wrap"><select id={id} value={random?.selected ? 'random' : value} onChange={event => { if (event.target.value === 'random' && random) random.onSelect(); else onChange(event.target.value); }}>{random && <option value="random">Random</option>}{children}</select><ChevronDown size={15} aria-hidden="true" /></div>{hint && <p className="map-setting-hint">{hint}</p>}</div>;
}

export function CustomMapSetup({ settings, onChange, onLaunch, onBack, isHardMode, setIsHardMode, isSoundEnabled, presetSavingEnabled, presetSaveFailed, onTogglePresetSaving }: {
  settings: CustomMapSettings; onChange: (settings: CustomMapSettings) => void; onLaunch: (map: MapDefinition) => void; onBack: () => void;
  isHardMode: boolean; setIsHardMode: (value: boolean) => void; isSoundEnabled: boolean;
  presetSavingEnabled: boolean; presetSaveFailed: boolean; onTogglePresetSaving: () => void;
}) {
  const [seedText, setSeedText] = useState(String(settings.seed));
  const [randomRoll, setRandomRoll] = useState(newCustomMapRoll);
  const resolved = useMemo(() => resolveCustomMapSettings(settings, randomRoll), [settings, randomRoll]);
  const previewDialog = useRef<HTMLDialogElement>(null);
  const quick = settings.style === 'quick-match';
  const binary = settings.quickLayout === 1 || settings.quickLayout === 3;
  const randomSystems = settings.randomSettings?.includes('composition') ?? false;
  const labels = quick ? QUICK_LABELS : CHAOS_LABELS;
  const selectedLayout = quick ? settings.quickLayout : settings.chaosLayout;
  const displayedSeed = quick && settings.quickAutomaticSeed ? String(resolved.seed) : seedText;
  const seedValid = /^\d+$/.test(displayedSeed) && Number(displayedSeed) <= 0xFFFFFFFF;
  const result = useMemo(() => {
    try { return { map: createCustomMap(resolved), error: '' }; }
    catch (error) { return { map: undefined, error: error instanceof Error ? error.message : 'This combination cannot form a connected map. Try another layout.' }; }
  }, [resolved]);
  const map = result.map;
  const update = (patch: Partial<CustomMapSettings>, sound = true) => {
    onChange(normalizeCustomMap({ ...settings, ...patch }));
    if (sound) playSound('select', isSoundEnabled);
  };
  const randomChoice = (key: CustomMapRandomSetting): RandomChoice => ({
    selected: settings.randomSettings?.includes(key) ?? false,
    onSelect: () => update({ randomSettings: [...new Set([...(settings.randomSettings ?? []), key])] }),
  });
  const choose = <K extends CustomMapRandomSetting>(key: K, value: CustomMapSettings[K]) => update({ [key]: value, randomSettings: settings.randomSettings?.filter(field => field !== key) });
  const randomHint = (key: CustomMapRandomSetting, label: string | number) => settings.randomSettings?.includes(key) ? `This match: ${label}. Rolls again for each new match.` : undefined;
  const randomize = () => {
    const entropy = new Uint32Array(4);
    try { crypto.getRandomValues(entropy); } catch { entropy.forEach((_, i) => { entropy[i] = Math.floor(Math.random() * 4294967296); }); }
    const seed = entropy[0];
    setRandomRoll(newCustomMapRoll());
    setSeedText(String(seed));
    update({ seed, quickLayout: entropy[1] % 4, chaosLayout: entropy[1] % 4, orbitingPlanets: (5 + entropy[2] % 3) as 5 | 6 | 7, flankRegions: (entropy[3] % 2) as 0 | 1, composition: (entropy[2] % 4) as 0 | 1 | 2 | 3 });
  };
  const summary = map ? `${map.planets.length} planets · ${map.orbits?.length ?? 0} ${(map.orbits?.length ?? 0) === 1 ? 'star' : 'stars'} · 4 factions` : 'Choose your battlefield';

  return <main className="custom-map-screen">
    <div className="custom-map-shell">
      <header className="custom-map-heading">
        <div className="custom-map-title"><p className="map-kicker"><SlidersHorizontal size={13} /> Custom Map</p><h1>Choose your own map<span>.</span></h1><p>Shape the battlefield. Choose your strategy.</p></div>
        <button type="button" className="map-close" aria-label="Close map setup" onClick={onBack}><X size={22} /></button>
      </header>
      <div className="custom-map-workspace">
        <section className="map-controls map-bracket-panel" aria-label="Map settings">
          <div className="map-style-switch" role="group" aria-label="Battlefield style">
            <button type="button" aria-pressed={quick} onClick={() => update({ style: 'quick-match' })}><Swords size={17} /> Quick Match</button>
            <button type="button" aria-pressed={!quick} onClick={() => update({ style: 'chaos-mode' })}><Orbit size={17} /> Chaos</button>
          </div>
          <div className="map-control-fields"><fieldset className="map-layout-setting"><legend>Layout</legend><div className="map-layout-grid">{labels.map((label, index) => <label key={label} className="map-layout-option">
            <input type="radio" name="custom-map-layout" checked={selectedLayout === index} onChange={() => update(quick ? { quickLayout: index } : { chaosLayout: index })} />
            <span className="map-layout-card"><LayoutThumbnail index={index} chaos={!quick} /><span>{label}</span>{selectedLayout === index && <Check className="map-layout-check" size={13} />}</span>
          </label>)}</div></fieldset>
          <div className="map-settings-list">{quick ? <>
            <Choices label="Orbiting planets" value={binary ? 5 : settings.orbitingPlanets} random={randomChoice('orbitingPlanets')} options={[5, 6, 7].map(value => ({ value: value as 5 | 6 | 7, label: String(value), disabled: binary && value !== 5 }))} onChange={value => choose('orbitingPlanets', value)} hint={[randomHint('orbitingPlanets', resolved.orbitingPlanets), binary ? 'Two-star layouts use five worlds per orbit.' : undefined].filter(Boolean).join(' ') || undefined} />
            {binary ? <div className="map-setting map-fixed-setting"><span>Flank regions</span><strong>{selectedLayout === 3 ? 'Public arenas' : 'Outer bypass'}</strong><p className="map-setting-hint">{selectedLayout === 3 ? 'Two public weapon regions connect the outer routes.' : 'A fixed four-world route joins the two fronts.'}</p></div> : <Choices label="Flank regions" value={settings.flankRegions} random={randomChoice('flankRegions')} options={(settings.quickLayout === 2 ? [1, 2] : [0, 1]).map(value => ({ value: value as 0 | 1 | 2, label: String(value) }))} onChange={value => choose('flankRegions', value)} hint={randomHint('flankRegions', resolved.flankRegions)} />}
            <SelectSetting label="Weapon focus" value={settings.weaponFocus} random={randomChoice('weaponFocus')} onChange={value => choose('weaponFocus', value as CustomMapSettings['weaponFocus'])} hint={randomHint('weaponFocus', WEAPON_LABELS[resolved.weaponFocus])}><option value="balanced">Balanced</option><option value="production">Production Overdrive</option><option value="defense">Repulse Shield</option><option value="strike">Omni Strike</option></SelectSetting>
          </> : <>
            <SelectSetting label="Systems" value={settings.composition} random={randomChoice('composition')} onChange={value => choose('composition', Number(value) as CustomMapSettings['composition'])} hint={randomHint('composition', COMPOSITIONS[resolved.composition]) ?? COMPOSITION_HINTS[resolved.composition]}>{COMPOSITIONS.map((label, index) => <option key={label} value={index}>{label}</option>)}</SelectSetting>
            {(randomSystems || resolved.composition >= 2) && <Choices label="Small-system planets" value={settings.smallPlanets} random={randomChoice('smallPlanets')} options={[5, 6, 7].map(value => ({ value: value as 5 | 6 | 7, label: String(value) }))} onChange={value => choose('smallPlanets', value)} hint={resolved.composition >= 2 ? randomHint('smallPlanets', resolved.smallPlanets) : 'Used when the randomly chosen systems include small systems.'} />}
            {(randomSystems || resolved.composition === 1 || resolved.composition === 2) && <SelectSetting label="Normal formation" value={resolved.normalPattern} random={randomChoice('normalPattern')} onChange={value => choose('normalPattern', value as CustomMapSettings['normalPattern'])} hint={resolved.composition === 1 || resolved.composition === 2 ? randomHint('normalPattern', FORMATION_LABELS[resolved.normalPattern]) : 'Used when the randomly chosen systems include normal systems.'}><option value="classic">Classic rings · 12 worlds</option><option value="scattered">Scattered · 12 worlds</option>{resolved.composition === 2 && <option value="pentagon-web">Pentagon web · 13 worlds</option>}</SelectSetting>}
            <Choices label="Weapons per world" value={settings.weaponsPerWorld} random={randomChoice('weaponsPerWorld')} options={[{ value: 'mixed', label: 'Mixed' }, { value: 1, label: '1' }, { value: 2, label: '2' }]} onChange={value => choose('weaponsPerWorld', value)} hint={randomHint('weaponsPerWorld', resolved.weaponsPerWorld === 'mixed' ? 'Mixed (1–2 per planet)' : `${resolved.weaponsPerWorld} per planet`)} />
          </>}
            <SelectSetting label="Defenders" value={settings.defenders} random={randomChoice('defenders')} onChange={value => choose('defenders', value as CustomMapSettings['defenders'])} hint={randomHint('defenders', DEFENDER_LABELS[resolved.defenders])}><option value="light">Light</option><option value="standard">Standard</option><option value="fortified">Fortified</option></SelectSetting>
          </div>
          <details className="map-advanced"><summary><SlidersHorizontal size={15} /> Advanced settings <ChevronRight size={16} /></summary><div className="map-advanced-fields">
            <SelectSetting label="Starting capital" value={settings.startingCapital} random={randomChoice('startingCapital')} onChange={value => choose('startingCapital', Number(value) as CustomMapSettings['startingCapital'])} hint={randomHint('startingCapital', `Capital ${resolved.startingCapital + 1}`)}>{[0, 1, 2, 3].map(index => <option key={index} value={index}>Capital {index + 1}</option>)}</SelectSetting>
            <p className="map-setting-hint">Numbers in the preview mark the four starting positions. Your capital is blue.</p>
            <div className="map-setting map-difficulty"><span>AI difficulty</span><button type="button" aria-pressed={isHardMode} onClick={() => setIsHardMode(!isHardMode)}><Shield size={14} /> {isHardMode ? 'Hard' : 'Normal'}</button></div>
            <p className="map-setting-hint">All capitals start with 200 ships. Early expansion targets stay balanced.</p>
            <button type="button" className="map-text-button" onClick={() => { const seed = 284719; setSeedText(String(seed)); setRandomRoll(newCustomMapRoll()); update({ seed, randomSettings: [...new Set<CustomMapRandomSetting>([...(settings.randomSettings ?? []), 'startingCapital', 'defenders', 'weaponFocus'])] }); }}><RotateCcw size={13} /> Reset starting conditions</button>
          </div></details></div>
        </section>
        <section className="map-preview-panel map-bracket-panel" aria-labelledby="map-preview-heading">
          <header className="map-preview-header"><h2 id="map-preview-heading">Battlefield preview</h2><button type="button" className="map-icon-button" aria-label="Expand map preview" disabled={!map} onClick={() => previewDialog.current?.showModal()}><Expand size={17} /></button></header>
          <div className="map-preview-canvas">{map ? <MapPreview map={map} /> : <p className="map-generation-error" role="alert">{result.error}</p>}<span className="map-preview-watermark">{labels[selectedLayout]} / {quick ? QUICK_ROUTE_VARIANTS[selectedLayout][quickRouteVariant(resolved.seed)].replaceAll('-', ' ') : 'Chaos'}</span></div>
          <div className="map-preview-bottom"><div className="map-preview-legend"><span><i className="map-legend-player" /> Your capital</span><span><i className="map-legend-enemy" /> Enemy capital</span><span><i className="map-legend-weapon" /> Weapon world</span></div><p aria-live="polite" aria-atomic="true" className="map-summary">{summary}</p></div>
          <div className="map-preview-note"><Check size={13} /><span>{quick ? QUICK_BATTLE_PLANS[selectedLayout].description : 'Every world orbits. Connected routes at every orbital phase.'}</span></div>
        </section>
      </div>
      <footer className="custom-map-footer">
        <div className={`map-seed-tools${quick ? ' map-seed-tools-quick' : ''}`}><label className="map-seed-field"><span>Seed</span><input aria-label="Map seed" inputMode="numeric" value={displayedSeed} maxLength={10} aria-invalid={!seedValid} aria-describedby={!seedValid ? 'map-seed-error' : undefined} onChange={event => { const value = event.target.value; setSeedText(value); const patch = quick ? { quickAutomaticSeed: false } : {}; if (/^\d+$/.test(value) && Number(value) <= 0xFFFFFFFF) update({ ...patch, seed: Number(value) }, false); else if (quick) update(patch, false); }} /></label>{quick && <button type="button" className="map-seed-auto" aria-label="Automatic seed" aria-pressed={Boolean(settings.quickAutomaticSeed)} title="Generate a fresh Quick Match seed for each new match. Enter a seed to reproduce a map." onClick={() => { if (settings.quickAutomaticSeed) { setSeedText(String(resolved.seed)); update({ seed: resolved.seed, quickAutomaticSeed: false }); } else { setRandomRoll(newCustomMapRoll()); update({ quickAutomaticSeed: true }); } }}>Auto seed</button>}<button type="button" className="map-randomize" aria-label="Randomize" onClick={randomize}><Shuffle size={17} /><span>Randomize</span></button></div>
        <div className="map-footer-actions"><button type="button" className={`map-save${presetSaveFailed ? ' map-save-error' : ''}`} aria-label="Save preset" aria-pressed={presetSavingEnabled} aria-description={presetSaveFailed ? 'Saving failed in this browser.' : presetSavingEnabled ? 'Preset saving is on.' : 'Preset saving is off.'} title={presetSaveFailed ? 'This browser could not save your preference. Toggle to retry; you can still play.' : presetSavingEnabled ? 'Automatically saves your setup in this browser. Click to turn off.' : 'Preset saving is off. Click to remember your current setup.'} onClick={onTogglePresetSaving}>{presetSaveFailed ? <AlertTriangle size={16} /> : presetSavingEnabled ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}<span>Save preset</span></button><button type="button" className="map-launch" disabled={!map || !seedValid} onClick={() => { if (map && seedValid) { playSound('select', isSoundEnabled); onLaunch(map); } }}>Launch map <ArrowRight size={20} /></button></div>
        {!seedValid && <p className="map-footer-notice" id="map-seed-error" role="status">Enter a whole-number seed from 0 to 4294967295.</p>}
      </footer>
      <dialog ref={previewDialog} className="map-preview-dialog" aria-label="Expanded battlefield preview"><header><span>{labels[selectedLayout]} <small>{summary}</small></span><button type="button" className="map-icon-button" aria-label="Close expanded preview" onClick={() => previewDialog.current?.close()}><X size={22} /></button></header>{map && <MapPreview map={map} />}</dialog>
    </div>
  </main>;
}
