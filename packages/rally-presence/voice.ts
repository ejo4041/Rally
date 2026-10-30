/** Latest-only delivery across both packet reordering and same-meeting retries. */
export class VoiceSequence {
  private captureEpoch = -1;
  private sequence = -1;
  accept(frame: {captureEpoch?: number; sequence?: number}): boolean {
    if (!Number.isSafeInteger(frame.captureEpoch) || !Number.isSafeInteger(frame.sequence)) return false;
    if (frame.captureEpoch! < this.captureEpoch) return false;
    if (frame.captureEpoch! > this.captureEpoch) {
      this.captureEpoch = frame.captureEpoch!;
      this.sequence = -1;
    }
    if (frame.sequence! <= this.sequence) return false;
    this.sequence = frame.sequence!;
    return true;
  }
}
