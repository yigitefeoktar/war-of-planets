export type GalaxyTheme = 'tutorial' | 'breach' | 'orbit' | 'standard' | 'hard';

type GalaxyPreset = {
  backgroundColor: string;
  palette: readonly string[];
  cloudMultiplier: number;
  alphaMultiplier: number;
};

const PRESETS: Record<GalaxyTheme, GalaxyPreset> = {
  tutorial: {
    backgroundColor: '#03060d',
    palette: ['35, 81, 117', '43, 70, 125'],
    cloudMultiplier: 0.35,
    alphaMultiplier: 0.32,
  },
  breach: {
    backgroundColor: '#08050e',
    palette: ['95, 46, 132', '125, 52, 83', '103, 76, 67', '48, 69, 127'],
    cloudMultiplier: 1,
    alphaMultiplier: 0.9,
  },
  orbit: {
    backgroundColor: '#030a10',
    palette: ['27, 102, 135', '50, 80, 156', '92, 52, 143', '23, 105, 116'],
    cloudMultiplier: 1.1,
    alphaMultiplier: 1,
  },
  standard: {
    backgroundColor: '#03040c',
    palette: ['65, 48, 156', '11, 105, 122', '28, 69, 151', '126, 40, 127'],
    cloudMultiplier: 1,
    alphaMultiplier: 1,
  },
  hard: {
    backgroundColor: '#100408',
    palette: ['145, 36, 61', '115, 29, 67', '113, 37, 107', '151, 60, 45'],
    cloudMultiplier: 1.2,
    alphaMultiplier: 1.15,
  },
};

export function galaxyAppearance(width: number, height: number, theme: GalaxyTheme = 'standard') {
  const preset = PRESETS[theme];
  const areaScale = Math.max(0.15, Math.min(1.5, width * height / (3000 * 3000)));
  return {
    backgroundColor: preset.backgroundColor,
    palette: preset.palette,
    cloudCount: Math.max(1, Math.round(9 * areaScale * preset.cloudMultiplier)),
    starCount: Math.round(850 * areaScale),
    alphaMultiplier: preset.alphaMultiplier,
  };
}
