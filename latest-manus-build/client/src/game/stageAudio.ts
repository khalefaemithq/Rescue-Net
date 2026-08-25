import type { HazardKind } from "./stages";

type ActiveSource = { stop: () => void };

/** تسجيلات ميدانية مرخّصة CC0 — المصادر موثقة في ASSET_RESEARCH.md */
export const STAGE_RECORDINGS = {
  volcanoRumble: "/manus-storage/rescue-volcano-rumble_385098.ogg",
  eruptionBlast: "/manus-storage/rescue-eruption-blast_675739.ogg",
  lavaFlow: "/manus-storage/rescue-lava-flow_675730.ogg",
  blizzardWind: "/manus-storage/rescue-blizzard-wind_493680.ogg",
  heavySnowfall: "/manus-storage/rescue-heavy-snowfall_22606.ogg",
  winterWind: "/manus-storage/rescue-winter-wind_438876.ogg",
} as const;

type LoopKey = keyof typeof STAGE_RECORDINGS;

const ENVIRONMENT_LOOPS: Record<Exclude<HazardKind, "storm">, Partial<Record<LoopKey, number>>> = {
  volcano: { volcanoRumble: 0.62, lavaFlow: 0.4 },
  blizzard: { winterWind: 0.55, blizzardWind: 0.5, heavySnowfall: 0.42 },
};

type RealLoop = { audio: HTMLAudioElement; base: number; ready: boolean };

export class StageAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambience: ActiveSource[] = [];
  private loops = new Map<LoopKey, RealLoop>();
  private environment: HazardKind | null = null;
  private intensity = 0.5;
  private muted = false;
  private broken = new Set<LoopKey>();

  private getContext() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0.0001;
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

  private loopVolume(loop: RealLoop) {
    return this.muted ? 0 : Math.max(0, Math.min(1, loop.base * this.intensity));
  }

  private getLoop(key: LoopKey): RealLoop | null {
    if (this.broken.has(key)) return null;
    let loop = this.loops.get(key);
    if (!loop) {
      const audio = new Audio(STAGE_RECORDINGS[key]);
      audio.loop = true;
      audio.preload = "auto";
      audio.volume = 0;
      loop = { audio, base: ENVIRONMENT_LOOPS[this.environment === "volcano" ? "volcano" : "blizzard"][key] ?? 0.4, ready: false };
      audio.addEventListener("error", () => {
        this.broken.add(key);
        this.loops.delete(key);
      });
      audio.addEventListener("canplaythrough", () => {
        if (loop) loop.ready = true;
      }, { once: true });
      this.loops.set(key, loop);
      void audio.play().catch(() => {
        this.broken.add(key);
        this.loops.delete(key);
      });
    }
    return loop;
  }

  private refreshLoops() {
    const wanted = this.environment && this.environment !== "storm" ? ENVIRONMENT_LOOPS[this.environment] : {};
    this.loops.forEach((loop, key) => {
      const base = wanted[key as LoopKey];
      if (base === undefined) {
        loop.audio.pause();
        this.loops.delete(key);
      }
    });
    if (!this.muted) {
      Object.keys(wanted).forEach((key) => {
        const loop = this.getLoop(key as LoopKey);
        if (loop) loop.audio.volume = this.loopVolume(loop);
      });
    } else {
      this.loops.forEach((loop) => { loop.audio.volume = 0; });
    }
  }

  /** هبّة رياح قصيرة تتزامن مع انغلاق طريق ثلجي. */
  gust() {
    if (this.muted || this.environment !== "blizzard") return;
    const loop = this.loops.get("blizzardWind");
    const audio = loop?.audio;
    if (!audio || !loop.ready) return;
    const peak = this.loopVolume(loop) * 1.9;
    const now = performance.now();
    audio.volume = Math.min(1, peak);
    window.setTimeout(() => {
      audio.volume = this.loopVolume(loop);
    }, 1400 + (now % 400));
  }

  /** ثوران بركاني يتزامن مع رشقة قذائف الحمم. */
  playEruption(intensity = 1) {
    if (this.muted || this.environment !== "volcano") return;
    if (this.broken.has("eruptionBlast")) {
      this.cue("hazard");
      return;
    }
    const blast = new Audio(STAGE_RECORDINGS.eruptionBlast);
    blast.volume = Math.max(0, Math.min(1, 0.62 * intensity));
    blast.addEventListener("ended", () => {
      blast.src = "";
    });
    void blast.play().catch(() => this.cue("hazard"));
  }

  setEnvironment(kind: HazardKind | null, intensity = 0.35) {
    this.environment = kind;
    this.intensity = Math.max(0.2, Math.min(1, intensity));
    this.refreshLoops();
    if (kind === null || kind === "storm") {
      this.clearAmbience();
      if (kind === "storm") this.ambience = [this.createNoise("lowpass", 780, 0.014 * this.intensity), this.createTone(120, 0.004 * this.intensity, "sine", 0.07)];
      return;
    }
    const keys = Object.keys(ENVIRONMENT_LOOPS[kind]) as LoopKey[];
    if (keys.every((key) => this.broken.has(key))) {
      this.clearAmbience();
      if (kind === "volcano") {
        this.ambience = [this.createNoise("lowpass", 920, 0.018 * this.intensity), this.createTone(46, 0.031 * this.intensity, "sawtooth", 0.14), this.createTone(70, 0.009 * this.intensity, "sine", 0.08)];
      } else {
        this.ambience = [this.createNoise("bandpass", 1000, 0.02 * this.intensity), this.createTone(145, 0.006 * this.intensity, "sine", 0.1)];
      }
    }
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
      lfoGain.gain.value = frequency * 0.08;
      lfo.connect(lfoGain).connect(oscillator.frequency);
      lfo.start();
    }
    oscillator.start();
    return { stop: () => { try { oscillator.stop(); lfo?.stop(); } catch { /* already stopped */ } oscillator.disconnect(); gain.disconnect(); lfo?.disconnect(); lfoGain?.disconnect(); } };
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master && this.context) {
      this.master.gain.cancelScheduledValues(this.context.currentTime);
      this.master.gain.linearRampToValueAtTime(muted ? 0.0001 : 0.5, this.context.currentTime + 0.12);
    }
    this.loops.forEach((loop) => { loop.audio.volume = muted ? 0 : this.loopVolume(loop); });
  }

  cue(kind: "connect" | "hazard") {
    if (this.muted) return;
    const context = this.getContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    oscillator.type = kind === "hazard" ? "square" : "triangle";
    oscillator.frequency.setValueAtTime(kind === "hazard" ? 190 : 430, now);
    oscillator.frequency.exponentialRampToValueAtTime(kind === "hazard" ? 96 : 620, now + 0.18);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.045, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    oscillator.connect(gain).connect(this.master!);
    oscillator.start(now);
    oscillator.stop(now + 0.25);
  }

  dispose() {
    this.clearAmbience();
    this.loops.forEach((loop) => {
      loop.audio.pause();
      loop.audio.src = "";
    });
    this.loops.clear();
    void this.context?.close();
    this.context = null;
    this.master = null;
  }
}
