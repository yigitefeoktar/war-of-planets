import type { SuperweaponId } from './types';

type IconPath = { d: string; fill?: boolean };

// Shared by the SVG buttons and the canvas planet badges.
export const SUPERWEAPON_VISUALS: Record<SuperweaponId, { color: string; paths: IconPath[] }> = {
  overdrive: {
    color: '#ffc36a',
    paths: [{ d: 'M13.5 2.5 5.5 13h5l-1 8.5L18.5 10h-5V2.5Z', fill: true }],
  },
  repulse: {
    color: '#78dce8',
    paths: [
      { d: 'M12 2.5 19 5.5v5.7c0 4.5-2.6 7.8-7 10.3-4.4-2.5-7-5.8-7-10.3V5.5L12 2.5Z' },
      { d: 'M8.5 11.5h7M12 8v7' },
    ],
  },
  omni: {
    color: '#ce9cff',
    paths: [
      { d: 'M12 4a8 8 0 1 0 0 16 8 8 0 1 0 0-16Z' },
      { d: 'M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5' },
      { d: 'M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 1 0 0-5Z', fill: true },
    ],
  },
};

const ICON_DIAMETER = 30;

export function superweaponIconLayout(zoom: number, planetRadius: number) {
  // Keep badges readable at overview zoom without letting them dominate when zoomed in.
  const screenDiameter = Math.max(20, Math.min(ICON_DIAMETER * zoom, 42));
  return {
    scale: screenDiameter / (ICON_DIAMETER * zoom),
    gap: (screenDiameter + 4) / zoom,
    y: -(planetRadius + (screenDiameter / 2 + 6) / zoom),
  };
}
