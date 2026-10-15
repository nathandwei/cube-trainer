export function formatMs(ms: number): string {
  const centis = Math.floor(ms / 10);
  const minutes = Math.floor(centis / 6000);
  const seconds = (centis % 6000) / 100;
  if (minutes === 0) return seconds.toFixed(2);
  return `${minutes}:${seconds.toFixed(2).padStart(5, "0")}`;
}

export function formatSeconds(ms: number): string {
  return (ms / 1000).toFixed(2);
}
