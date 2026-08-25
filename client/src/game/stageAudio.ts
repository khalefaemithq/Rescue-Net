import type { HazardKind } from "./stages";

type ActiveSource = { stop: () => void };

export class StageAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambience: ActiveSource[] = [];
  private muted = false;

  private getContext() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = .0001;
      this.master.connect(this.context.destination);
    }
    return this.context;
  }

  async unlock() {
    const context = this.getContext();
    if (context.state === "suspended") await context.resume();
    this.setMuted(this.muted);
  }

  private clearAmbience() {
    this.ambience.forEach((source) => source.stop());
    this.ambience = [];
  }

  private createNoise(filterType: BiquadFilterType, frequency: number, volume: number): ActiveSource {
    const context = this.getContext();
    const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    source.loop = true;
    filter.type = filterType;
    filter.frequency.value = frequency;
    gain.gain.value = volume;
    source.connect(filter).connect(gain).connect(this.master!);
    source.start();
    return { stop: () => { try { source.stop(); } catch { /* already stopped */ } source.disconnect(); filter.disconnect(); gain.disconnect(); } };
  }

  private createTone(frequency: number, volume: number, type: OscillatorType, wobble?: number): ActiveSource {
    const context = this.getContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.value = volume;
    oscillator.connect(gain).connect(this.master!);
    let lfo: OscillatorNode | null = null;
    let lfoGain: GainNode | null = null;
    if (wobble) {
      lfo = context.createOscillator();
      lfoGain = context.createGain();
      lfo.frequency.value = wobble;
      lfoGain.gain.value = frequency * .08;
      lfo.connect(lfoGain).connect(oscillator.frequency);
      lfo.start();
    }
    oscillator.start();
    return { stop: () => { try { oscillator.stop(); lfo?.stop(); } catch { /* already stopped */ } oscillator.disconnect(); gain.disconnect(); lfo?.disconnect(); lfoGain?.disconnect(); } };
  }

  setEnvironment(kind: HazardKind | null, intensity = .35) {
    this.clearAmbience();
    if (!kind || this.muted) return;
    const scaled = Math.max(.2, Math.min(1, intensity));
    if (kind === "volcano") {
      this.ambience = [this.createNoise("lowpass", 920, .018 * scaled), this.createTone(46, .031 * scaled, "sawtooth", .14), this.createTone(70, .009 * scaled, "sine", .08)];
      return;
    }
    if (kind === "blizzard") {
      this.ambience = [this.createNoise("bandpass", 1000, .020 * scaled), this.createTone(145, .006 * scaled, "sine", .1)];
      return;
    }
    this.ambience = [this.createNoise("lowpass", 780, .014 * scaled), this.createTone(120, .004 * scaled, "sine", .07)];
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (!this.master || !this.context) return;
    this.master.gain.cancelScheduledValues(this.context.currentTime);
    this.master.gain.linearRampToValueAtTime(muted ? .0001 : .5, this.context.currentTime + .12);
  }

  cue(kind: "connect" | "hazard") {
    if (this.muted) return;
    const context = this.getContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    oscillator.type = kind === "hazard" ? "square" : "triangle";
    oscillator.frequency.setValueAtTime(kind === "hazard" ? 190 : 430, now);
    oscillator.frequency.exponentialRampToValueAtTime(kind === "hazard" ? 96 : 620, now + .18);
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(.045, now + .015);
    gain.gain.exponentialRampToValueAtTime(.0001, now + .22);
    oscillator.connect(gain).connect(this.master!);
    oscillator.start(now);
    oscillator.stop(now + .25);
  }

  dispose() {
    this.clearAmbience();
    void this.context?.close();
    this.context = null;
    this.master = null;
  }
}
