import { useId, useMemo } from 'react';
import { NEUTRAL, type MapDefinition } from '../game/campaign';
import { customMapCapitals } from '../game/customMaps';
import { distance } from '../game/mapGenerationUtils';

export function MapPreview({ map }: { map: MapDefinition }) {
  const id = useId().replace(/:/g, '');
  const capitals = useMemo(() => customMapCapitals(map), [map]);
  const links = useMemo(() => map.planets.flatMap((planet, index) => map.planets.slice(index + 1)
    .filter(other => distance(planet, other) <= map.attackRange)
    .map(other => ({ a: planet, b: other }))), [map]);
  return <svg className="custom-map-svg" viewBox={`0 0 ${map.width} ${map.height}`} role="img" aria-label={`Preview of your map: ${map.planets.length} planets, ${map.orbits?.length ?? 0} stars and four numbered capitals. Blue is your starting capital.`}>
    <defs>
      <radialGradient id={`${id}-space`}><stop stopColor="#0d3653" stopOpacity=".5" /><stop offset="1" stopColor="#020a13" stopOpacity="0" /></radialGradient>
      <radialGradient id={`${id}-star`}><stop stopColor="#fffbdc" /><stop offset=".45" stopColor="#ffe6a3" /><stop offset="1" stopColor="#f6ac44" /></radialGradient>
      <radialGradient id={`${id}-halo`}><stop stopColor="#ffd587" stopOpacity=".32" /><stop offset="1" stopColor="#ffd587" stopOpacity="0" /></radialGradient>
      <radialGradient id={`${id}-planet`} cx="30%" cy="25%"><stop stopColor="#c2d9e9" /><stop offset=".4" stopColor="#7797af" /><stop offset="1" stopColor="#233d52" /></radialGradient>
      {['#3b82f6', '#ef4444', '#22c55e', '#eab308'].map((color, i) => <radialGradient key={color} id={`${id}-faction-${i}`} cx="30%" cy="25%"><stop stopColor="#ecfaff" /><stop offset=".28" stopColor={color} /><stop offset="1" stopColor={color} stopOpacity=".3" /></radialGradient>)}
    </defs>
    <ellipse cx={map.width * .48} cy={map.height * .5} rx={map.width * .65} ry={map.height * .45} fill={`url(#${id}-space)`} transform={`rotate(-25 ${map.width / 2} ${map.height / 2})`} />
    {Array.from({ length: 90 }, (_, i) => <circle key={i} cx={(i * 733.13 + 61) % map.width} cy={(i * 391.71 + 43) % map.height} r={i % 7 === 0 ? 2.7 : 1.3} fill="#b1d9f8" opacity={.15 + (i % 5) * .1} />)}
    <g stroke="#6da5c1" strokeWidth="3" opacity=".35">{links.map(({ a, b }) => <line key={`${a.id}-${b.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />)}</g>
    {map.orbits?.map((orbit, index) => {
      const members = map.planets.filter(planet => orbit.planetIds.includes(planet.id));
      const radii = [...new Set(members.map(planet => Math.round(distance(planet, orbit) / 20) * 20))];
      return <g key={index}>
        {radii.map(radius => <circle key={radius} cx={orbit.x} cy={orbit.y} r={radius} fill="none" stroke="#75c6e2" strokeWidth="2" strokeDasharray="8 12" opacity=".35" />)}
        <circle cx={orbit.x} cy={orbit.y} r="180" fill={`url(#${id}-halo)`} />
        <circle cx={orbit.x} cy={orbit.y} r="60" fill={`url(#${id}-star)`} stroke="#fff0b5" strokeWidth="3" />
        <path d={`M${orbit.x - 75} ${orbit.y}h150M${orbit.x} ${orbit.y - 75}v150`} stroke="#ffe8ab" strokeWidth="2" opacity=".45" />
      </g>;
    })}
    {map.planets.map(planet => {
      const capitalIndex = capitals.findIndex(capital => capital.id === planet.id);
      const factionIndex = ['#3b82f6', '#ef4444', '#22c55e', '#eab308'].indexOf(planet.owner);
      const radius = planet.capital ? 62 : 37;
      const weapon = planet.superweaponUnlocks?.[0];
      const weaponColor = weapon === 'overdrive' ? '#fbbf24' : weapon === 'repulse' ? '#67e8f9' : '#c4b5fd';
      return <g key={planet.id}>
        <title>{planet.capital ? `Capital ${capitalIndex + 1}${planet.owner === '#3b82f6' ? ' — Your start' : ''}` : 'Neutral world'} · {planet.ships} ships{planet.superweaponUnlocks?.length ? ` · ${planet.superweaponUnlocks.join(', ')}` : ''}</title>
        {planet.capital && <circle cx={planet.x} cy={planet.y} r="82" fill={planet.owner} opacity=".15" />}
        <circle cx={planet.x} cy={planet.y} r={radius} fill={`url(#${id}-${planet.owner === NEUTRAL ? 'planet' : `faction-${factionIndex}`})`} stroke={planet.owner === NEUTRAL ? '#7e9aae' : planet.owner} strokeWidth={planet.capital ? 5 : 2} />
        {weapon && <path d={`M${planet.x} ${planet.y - radius - 31}l12 16-12 16-12-16Z`} fill={weaponColor} />}
        {planet.capital && <text x={planet.x} y={planet.y + 13} textAnchor="middle" fontFamily="monospace" fontSize="39" fontWeight="700" fill="#fff">{capitalIndex + 1}</text>}
      </g>;
    })}
  </svg>;
}

export function LayoutThumbnail({ index, chaos = false }: { index: number; chaos?: boolean }) {
  const nodes = chaos
    ? index === 1 ? [[50, 40], [17, 15], [83, 15], [50, 73]] : index === 2 ? [[25, 20], [75, 20], [75, 65], [25, 65]] : [[18, 43], [43, 20], [67, 39], [83, 66]]
    : [
      [[18, 16], [82, 16], [82, 70], [18, 70]],
      [[12, 18], [50, 12], [88, 18], [88, 68], [50, 74], [12, 68]],
      [[15, 27], [37, 10], [80, 18], [85, 62], [63, 78], [15, 65]],
      [[16, 18], [42, 18], [42, 42], [74, 42], [74, 68], [46, 68], [46, 44], [16, 44]],
    ][index];
  return <svg viewBox="0 0 100 86" aria-hidden="true">
    <path d={`M${nodes.map(point => point.join(',')).join('L')}${index === 0 && chaos ? '' : 'Z'}`} fill="none" stroke="currentColor" strokeWidth=".8" opacity=".45" />
    {!chaos && index === 0 && <path d="M18 16L82 70M82 16L18 70" fill="none" stroke="currentColor" strokeWidth=".8" opacity=".45" />}
    {!chaos && index === 1 && <path d="M50 12V74" stroke="currentColor" strokeWidth=".8" opacity=".45" />}
    {chaos ? nodes.map(([x, y], i) => <g key={i}><circle cx={x} cy={y} r="11" fill="none" stroke="currentColor" opacity=".25" /><circle cx={x} cy={y} r="4" fill={['#60a5fa', '#f87171', '#4ade80', '#facc15'][i]} /></g>) : <>
      <circle cx={index === 1 || index === 3 ? 35 : 50} cy="43" r="13" fill="none" stroke="currentColor" opacity=".3" />
      <circle cx={index === 1 || index === 3 ? 35 : 50} cy="43" r="4" fill="#ffe2a0" />
      {(index === 1 || index === 3) && <><circle cx="65" cy="43" r="13" fill="none" stroke="currentColor" opacity=".3" /><circle cx="65" cy="43" r="4" fill="#ffe2a0" /></>}
      {nodes.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.6" fill={i % 2 === 0 ? ['#60a5fa', '#f87171', '#4ade80', '#facc15'][i / 2] : '#94aabd'} />)}
      {index === 2 && <><path d="M80 58l14 12" stroke="currentColor" opacity=".4" /><circle cx="94" cy="70" r="4" fill="#c4b5fd" /></>}
    </>}
  </svg>;
}
