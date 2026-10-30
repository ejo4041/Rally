import { HttpError } from './auth.ts';

export const opening = 'Let’s get back on track.';
export function interventionSpeech(body: string) {
  return opening + ' ' + body.replace(/^(?:Let[’']?s get back on track\.\s*)+/i, '').trim();
}
export class SpeechError extends HttpError {
  retryAfter?: string;
  constructor(message: string, status: number, retryAfter?: string) { super(message, status); this.retryAfter = retryAfter; }
}
export type SpeechRequest = { input: string; voice?: 'default' };
export class SeamlessSpeech {
  private active = 0;
  private token: string; private endpoint: string; private request: typeof fetch; private concurrency: number;
  constructor(token: string, endpoint = 'https://2tluh56msb.execute-api.us-west-2.amazonaws.com/prod/v1/audio/speech', request: typeof fetch = fetch, concurrency = 1) { this.token=token; this.endpoint=endpoint; this.request=request; this.concurrency=concurrency; }
  async *stream(input: SpeechRequest, signal: AbortSignal, format: 'pcm' | 'wav' = 'pcm'): AsyncGenerator<Buffer> {
    signal.throwIfAborted();
    if (!input || typeof input.input !== 'string' || !input.input.trim() || [...input.input].length > 1200 || (input.voice !== undefined && input.voice !== 'default')) throw new SpeechError('Invalid speech input', 422);
    if (this.active >= this.concurrency) throw new SpeechError('Speech service busy', 429, '1');
    if (!this.token) throw new SpeechError('Speech service is not configured', 503);
    this.active++;
    const abort = new AbortController();
    const combined = AbortSignal.any([signal, abort.signal]);
    const total = setTimeout(() => abort.abort(), 120000);
    let idle = setTimeout(() => abort.abort(), 10000);
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      const response = await this.request(this.endpoint, {method:'POST', redirect:'error', signal:combined, headers:{Authorization:`Bearer ${this.token}`, 'Content-Type':'application/json'}, body:JSON.stringify({model:'facebook/seamless-m4t-v2-large', input:input.input, voice:'default', response_format:format, chunking:format === 'pcm' ? 'sentence' : 'none'})});
      if (!response.ok) throw new SpeechError('Speech provider request failed', [400,422,429].includes(response.status) ? response.status : 502, response.headers.get('Retry-After') || undefined);
      if (!response.body) throw new SpeechError('Speech provider returned no audio',502);
      reader = response.body.getReader();
      let bytes = 0;
      let carry = Buffer.alloc(0);
      while (true) {
        const {value,done} = await reader.read();
        combined.throwIfAborted();
        if (done) break;
        clearTimeout(idle); idle = setTimeout(() => abort.abort(),10000);
        bytes += value.byteLength;
        if (bytes > (format === 'pcm' ? 3840000 : 3840044)) throw new SpeechError('Speech output exceeds duration limit',502);
        if (format === 'wav') { yield Buffer.from(value); continue; }
        const data = Buffer.concat([carry, value]);
        const aligned = data.length - data.length % 2;
        carry = Buffer.from(data.subarray(aligned));
        if (aligned) yield data.subarray(0,aligned);
      }
      if (!bytes || carry.length) throw new SpeechError('Incomplete speech audio',502);
    } catch (error) {
      if (!signal.aborted && abort.signal.aborted) throw new SpeechError('Speech provider timed out',504);
      if (error instanceof SpeechError || signal.aborted) throw error;
      throw new SpeechError('Speech provider unavailable',502);
    } finally {
      clearTimeout(total); clearTimeout(idle); abort.abort();
      await reader?.cancel().catch(() => {});
      this.active--;
    }
  }
  async synthesize(input: SpeechRequest, signal: AbortSignal) {
    const parts: Buffer[] = [];
    for await (const part of this.stream(input, signal, 'wav')) parts.push(part);
    const wav = Buffer.concat(parts);
    if (wav.length < 44 || wav.toString('ascii',0,4) !== 'RIFF' || wav.toString('ascii',8,12) !== 'WAVE') throw new SpeechError('Invalid WAV response',502);
    let formatFound = false, audioBytes = 0;
    if (wav.readUInt32LE(4) !== wav.length - 8) throw new SpeechError('Invalid WAV length',502);
    let offset = 12;
    while (offset + 8 <= wav.length) {
      const kind = wav.toString('ascii',offset,offset+4), size = wav.readUInt32LE(offset+4);
      const start = offset + 8;
      if (start + size > wav.length) throw new SpeechError('Truncated WAV chunk',502);
      if (kind === 'fmt ') {
        if (formatFound || size < 16 || wav.readUInt16LE(start) !== 1 || wav.readUInt16LE(start+2) !== 1 || wav.readUInt32LE(start+4) !== 16000 || wav.readUInt32LE(start+8) !== 32000 || wav.readUInt16LE(start+12) !== 2 || wav.readUInt16LE(start+14) !== 16) throw new SpeechError('Unsupported WAV format',502);
        formatFound = true;
      }
      if (kind === 'data') {
        if (size % 2) throw new SpeechError('Invalid WAV samples',502);
        audioBytes += size;
      }
      offset = start + size + size % 2;
    }
    if (offset !== wav.length || !formatFound || !audioBytes || audioBytes > 3840000) throw new SpeechError('Invalid WAV audio',502);
    return wav;
  }
}
