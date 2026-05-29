export function pixelsToTime(
  deltaPixels: number,
  domainWidth: number,
  innerWidth: number
): number {
  if (innerWidth === 0) return 0;
  return (deltaPixels / innerWidth) * domainWidth;
}

export function panDomain(
  current: [number, number],
  deltaTime: number,
  bounds: [number, number]
): [number, number] {
  const width = current[1] - current[0];
  let newMin = current[0] + deltaTime;
  let newMax = current[1] + deltaTime;
  if (newMin < bounds[0]) {
    newMin = bounds[0];
    newMax = bounds[0] + width;
  }
  if (newMax > bounds[1]) {
    newMax = bounds[1];
    newMin = bounds[1] - width;
  }
  return [newMin, newMax];
}
