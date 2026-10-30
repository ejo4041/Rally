let anchor = { server: Date.now(), local: performance.now() },
  bestLatency = Infinity;
export function synchronizeClock(
  server: number,
  sent: number,
  received: number,
) {
  const latency = received - sent;
  if (!Number.isFinite(server) || latency < 0) return;
  if (latency <= bestLatency * 1.5 || received - anchor.local > 60000) {
    anchor = { server: server + latency / 2, local: received };
    bestLatency = latency;
  }
}
export function serverNow() {
  return anchor.server + performance.now() - anchor.local;
}
