import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { serve } from './serve.mjs';

const server = await serve();
let browser;
try {
  browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
  const page = await browser.newPage();
  const blockedExternal = [];
  await page.route('**/*', route => {
    if (new URL(route.request().url()).hostname === 'localhost') return route.continue();
    blockedExternal.push(new URL(route.request().url()).hostname);
    return route.abort();
  });
  await page.goto(`http://localhost:${server.address().port}`);
  await page.waitForFunction(() => !!window.sdkProbe);
  const result = await page.evaluate(async () => {
    const { CallClient, LocalAudioStream, virtualMic } = window.sdkProbe;
    const context = new AudioContext({ sampleRate: 48000 });
    await context.resume();
    const mic = virtualMic(context);
    const sdkStream = new LocalAudioStream(mic.stream);
    const sdkMedia = await sdkStream.getMediaStream();
    const client = new CallClient();
    const peerA = new RTCPeerConnection({ iceServers: [] });
    const peerB = new RTCPeerConnection({ iceServers: [] });
    const human = context.createMediaStreamDestination();
    const humanOsc = context.createOscillator();
    const humanGain = context.createGain();
    humanOsc.frequency.value = 880;
    humanGain.gain.value = 0.2;
    humanOsc.connect(humanGain).connect(human);
    humanOsc.start();
    const receive = peer => new Promise(resolve => peer.addEventListener('track', event => {
      const media = new MediaStream([event.track]);
      const audio = document.createElement('audio');
      audio.srcObject = media;
      audio.autoplay = true;
      audio.volume = 0;
      document.body.append(audio);
      audio.play().catch(() => {});
      const source = context.createMediaStreamSource(media);
      const analyser = context.createAnalyser();
      analyser.fftSize = 8192;
      source.connect(analyser);
      const silentSink = context.createGain();
      silentSink.gain.value = 0;
      analyser.connect(silentSink).connect(context.destination);
      resolve(analyser);
    }, { once: true }));
    const incomingAtRally = receive(peerA);
    const incomingAtHuman = receive(peerB);
    for (const track of mic.stream.getTracks()) peerA.addTrack(track, mic.stream);
    for (const track of human.stream.getTracks()) peerB.addTrack(track, human.stream);
    async function gather(peer) {
      if (peer.iceGatheringState === 'complete') return;
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('ICE gathering timeout')), 5000);
        const check = () => {
          if (peer.iceGatheringState !== 'complete') return;
          clearTimeout(timer); peer.removeEventListener('icegatheringstatechange', check); resolve();
        };
        peer.addEventListener('icegatheringstatechange', check);
        check();
      });
    }
    await peerA.setLocalDescription(await peerA.createOffer());
    await gather(peerA);
    await peerB.setRemoteDescription(peerA.localDescription);
    await peerB.setLocalDescription(await peerB.createAnswer());
    await gather(peerB);
    await peerA.setRemoteDescription(peerB.localDescription);
    const [rallyAnalyser, humanAnalyser] = await Promise.all([incomingAtRally, incomingAtHuman]);
    const buffer = context.createBuffer(1, 48000 * 8, 48000);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = 0.2 * Math.sin(2 * Math.PI * 440 * i / 48000);
    mic.play(buffer);
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    await wait(1500);
    function measure(analyser) {
      const wave = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(wave);
      const bins = new Float32Array(analyser.frequencyBinCount);
      analyser.getFloatFrequencyData(bins);
      let peak = 0;
      for (let i = 1; i < bins.length; i++) if (bins[i] > bins[peak]) peak = i;
      const around = frequency => {
        const bin = Math.round(frequency * analyser.fftSize / context.sampleRate);
        return Math.max(...bins.slice(bin - 2, bin + 3));
      };
      return {
        rms: Math.sqrt(wave.reduce((sum, value) => sum + value * value, 0) / wave.length),
        peakHz: peak * context.sampleRate / analyser.fftSize,
        db440: around(440), db880: around(880)
      };
    }
    const listening = measure(rallyAnalyser);
    const speaking = measure(humanAnalyser);
    mic.stop();
    await wait(600);
    const afterStop = measure(humanAnalyser);
    const stillListening = measure(rallyAnalyser);
    const output = {
      browser: navigator.userAgent,
      audioContextState: context.state,
      audioContextTime: context.currentTime,
      sampleRate: context.sampleRate,
      sdkClientConstructed: !!client,
      sdkCustomStreamTracks: sdkMedia.getAudioTracks().length,
      peerA: peerA.connectionState, peerB: peerB.connectionState,
      listening, speaking, afterStop, stillListening,
      speechVoices: speechSynthesis.getVoices().length,
      realMeetingJoined: false, museCalls: 0
    };
    output.rtcAudioStats = [...(await peerA.getStats()).values()].filter(stat => ['inbound-rtp', 'outbound-rtp', 'media-source'].includes(stat.type));
    peerA.close(); peerB.close();
    humanOsc.stop(); human.stream.getTracks().forEach(track => track.stop());
    sdkStream.dispose(); mic.dispose();
    await client.dispose(); await context.close();
    return output;
  });
  console.log(JSON.stringify(result, null, 2));
  assert.equal(result.sdkCustomStreamTracks, 1);
  assert.equal(result.peerA, 'connected');
  assert.equal(result.peerB, 'connected');
  assert.ok(Math.abs(result.listening.peakHz - 880) < 20, 'Rally receives human channel');
  assert.ok(Math.abs(result.speaking.peakHz - 440) < 20, 'Human receives Rally channel');
  assert.ok(result.listening.db880 - result.listening.db440 > 20, 'Rally output isolated from its input');
  assert.ok(result.afterStop.rms < 0.005, 'Stop clears output');
  assert.ok(result.stillListening.rms > 0.02, 'Input remains active during output stop');
  await mkdir('test-results', { recursive: true });
  await writeFile('test-results/local-probe.json', JSON.stringify({ testedAt: new Date().toISOString(), ...result, blockedExternal }, null, 2) + '\n');
  console.log('PASS: SDK load/custom stream, local bidirectional WebRTC, channel isolation and output stop. No Teams join.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
