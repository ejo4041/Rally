// Schedule from elapsed monotonic time, not one frame per timer callback.
// A delayed callback may catch up at most 200ms; total audio never outruns
// capture time or the session cap. Larger stalls remain bounded by the queue.
export function framesDue(elapsedMs, sentBytes, maxBytes) {
  const allowed = Math.min(maxBytes, Math.floor(Math.max(0,elapsedMs) / 20) * 640);
  return Math.max(0,Math.min(10,Math.floor((allowed-sentBytes)/640)));
}
