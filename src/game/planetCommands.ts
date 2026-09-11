/** Keep the planet visible; use a scrollable panel when a phone has no side room. */
export function planetCommandPosition(x: number, y: number, gap: number, width: number, height: number, panelWidth: number, panelHeight: number) {
  const margin = 8, header = 96;
  const maxHeight = Math.max(44, height - header - margin);
  const h = Math.min(panelHeight, maxHeight);
  const besideY = Math.max(header, Math.min(height - h - margin, y - h / 2));
  if (x + gap + panelWidth <= width - margin) return { left: x + gap, top: besideY, maxHeight };
  if (x - gap - panelWidth >= margin) return { left: x - gap - panelWidth, top: besideY, maxHeight };
  const below = height - y - gap - margin;
  const above = y - gap - header;
  const useBelow = below >= above;
  const space = Math.max(44, useBelow ? below : above);
  return {
    left: Math.max(margin, Math.min(width - panelWidth - margin, x - panelWidth / 2)),
    top: useBelow ? y + gap : y - gap - Math.min(panelHeight, space),
    maxHeight: space,
  };
}
