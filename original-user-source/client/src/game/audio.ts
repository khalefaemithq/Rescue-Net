export type RescueSound = "tap" | "start" | "connect" | "ambulance" | "emergency" | "upgrade" | "storm" | "landfall";

export const REAL_AUDIO_ASSETS = {
  storm: "/manus-storage/rescue-storm-real_fe340184.ogg",
  ambulance: "/manus-storage/rescue-ambulance-field-real_765495ba.ogg",
  thunder: "/manus-storage/rescue-thunder-cc0_58ee3e10.ogg",
} as const;

type RealTrack = keyof typeof REAL_AUDIO_ASSETS;
type LoopTrack = Exclude<RealTrack, "thunder">;

const STORM_VOLUMES = [0.08, 0.14, 0.22, 0.31, 0.4, 0.5] as const;
const STORM_INTENSITIES = [0.12, 0.26, 0.42, 0.58, 0.74, 0.92] as const;
const THUNDER_INTERVALS = [15, 10, 6, 5, 5, 3] as const;

export function getStormStage(elapsed: number) {
  if (elapsed < 30) return 1;
  if (elapsed < 60) return 2;
  if (elapsed < 90) return 3;
  if (elapsed < 120) return 4;
  if (elapsed < 150) return 5;
  return 6;
}

export function getStormIntensityForStage(stage: number) {
  return STORM_INTENSITIES[Math.max(0, Math.min(5, stage - 1))] ?? STORM_INTENSITIES[0];
}

export function getStormVolumeForStage(stage: number) {
  return STORM_VOLUMES[Math.max(0, Math.min(5, stage - 1))] ?? STORM_VOLUMES[0];
}

export function getThunderIntervalForStage(stage: number) {
  return THUNDER_INTERVALS[Math.max(0, Math.min(5, stage - 1))] ?? THUNDER_INTERVALS[0];
}

export type ThunderCue = { index: number; thunderAt: number; lightningAt: number; stage: number; intensity: number };

export function getThunderCue(elapsed: number): ThunderCue | null {
  if (elapsed < 0) return null;
  let lastCue: ThunderCue | null = null;
  let index = 0;
  for (let stage = 1; stage <= 6; stage += 1) {
    const start = (stage - 1) * 30;
    const end = start + 30;
    const interval = getThunderIntervalForStage(stage);
    for (let thunderAt = start; thunderAt < end; thunderAt += interval) {
      if (thunderAt > elapsed) return lastCue;
      lastCue = { index, thunderAt, lightningAt: thunderAt + 2, stage, intensity: getStormIntensityForStage(stage) };
      index += 1;
    }
  }
  return lastCue;
}

export class RescueAudio {
  private context: AudioContext | null = null;
  private tracks = new Map<RealTrack, HTMLAudioElement>();
  private fades = new Map<LoopTrack, number>();
  private targets = new Map<LoopTrack, number>();
  private thunderTimers = new Set<number>();

  private getContext() {
    if (!this.context) this.context = new AudioContext();
    if (this.context.state === "suspended") void this.context.resume();
    return this.context;
  }

  private getTrack(kind: RealTrack) {
    const existing = this.tracks.get(kind);
    if (existing) return existing;
    const track = new Audio(REAL_AUDIO_ASSETS[kind]);
    track.preload = "auto";
    track.loop = kind !== "thunder";
    track.volume = 0;
    track.muted = false;
    track.setAttribute("data-rescue-audio", `${kind}-real`);
    track.setAttribute("aria-hidden", "true");
    track.tabIndex = -1;
    document.body.appendChild(track);
    this.tracks.set(kind, track);
    return track;
  }

  private fadeTrack(kind: LoopTrack, targetVolume: number, durationMs = 1200) {
    const track = this.getTrack(kind);
    const existingTarget = this.targets.get(kind);
    if (existingTarget !== undefined && Math.abs(existingTarget - targetVolume) < 0.001) return;
    this.targets.set(kind, targetVolume);
    const previous = this.fades.get(kind);
    if (previous !== undefined) window.clearInterval(previous);
    const start = track.volume;
    const steps = 12;
    let step = 0;
    const timer = window.setInterval(() => {
      step += 1;
      track.volume = Math.max(0, Math.min(1, start + (targetVolume - start) * (step / steps)));
      if (step >= steps) {
        window.clearInterval(timer);
        this.fades.delete(kind);
      }
    }, Math.max(40, Math.floor(durationMs / steps)));
    this.fades.set(kind, timer);
  }

  private ensurePlaying(kind: LoopTrack) {
    const track = this.getTrack(kind);
    const attempt = track.play();
    if (attempt) void attempt.catch(() => undefined);
    return track;
  }

  unlock() {
    this.getContext();
    (["storm", "ambulance"] as LoopTrack[]).forEach((kind) => {
      const track = this.ensurePlaying(kind);
      track.volume = 0;
    });
  }

  startStormImmediately() {
    const track = this.ensurePlaying("storm");
    const volume = getStormVolumeForStage(1);
    track.volume = volume;
    this.targets.set("storm", volume);
  }

  private playTone(frequency: number, duration: number, type: OscillatorType, volume: number) {
    const context = this.getContext();
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.04);
  }

  setAmbulanceActive(active: boolean) {
    if (!active) {
      const track = this.tracks.get("ambulance");
      if (!track) return;
      this.fadeTrack("ambulance", 0, 260);
      window.setTimeout(() => {
        if (track.volume < 0.002) {
          track.pause();
          track.currentTime = 0;
        }
      }, 310);
      return;
    }
    this.ensurePlaying("ambulance");
    this.fadeTrack("ambulance", 0.0267, 520);
  }

  setStormIntensity(intensity: number) {
    const clamped = Math.max(0, Math.min(1, intensity));
    if (clamped === 0) {
      const track = this.tracks.get("storm");
      if (!track) return;
      this.fadeTrack("storm", 0, 280);
      window.setTimeout(() => track.volume < 0.002 && track.pause(), 340);
      return;
    }
    this.ensurePlaying("storm");
    const minimum = getStormVolumeForStage(1);
    const maximum = getStormVolumeForStage(6);
    this.fadeTrack("storm", minimum + (maximum - minimum) * clamped, 1100);
  }

  playThunder(intensity: number) {
    const scheduled = window.setTimeout(() => {
      this.thunderTimers.delete(scheduled);
      const clap = new Audio(REAL_AUDIO_ASSETS.thunder);
      clap.preload = "auto";
      clap.volume = Math.max(0.12, Math.min(0.58, 0.12 + intensity * 0.42));
      clap.setAttribute("data-rescue-audio", "thunder-real");
      clap.setAttribute("aria-hidden", "true");
      document.body.appendChild(clap);
      const remove = () => clap.remove();
      clap.onended = remove;
      clap.onerror = remove;
      const attempt = clap.play();
      if (attempt) void attempt.catch(remove);
    }, 0);
    this.thunderTimers.add(scheduled);
  }

  play(sound: RescueSound) {
    if (sound === "ambulance") {
      this.setAmbulanceActive(true);
      return;
    }
    if (sound === "storm" || sound === "landfall") return;
    const tones: Record<Exclude<RescueSound, "ambulance" | "storm" | "landfall">, [number, number, OscillatorType, number]> = {
      tap: [174, 0.075, "sine", 0.022],
      start: [360, 0.15, "sine", 0.035],
      connect: [250, 0.1, "triangle", 0.026],
      emergency: [650, 0.2, "square", 0.03],
      upgrade: [590, 0.2, "triangle", 0.04],
    };
    const [frequency, duration, type, volume] = tones[sound];
    this.playTone(frequency, duration, type, volume);
  }

  dispose() {
    this.fades.forEach((timer) => window.clearInterval(timer));
    this.fades.clear();
    this.targets.clear();
    this.thunderTimers.forEach((timer) => window.clearTimeout(timer));
    this.thunderTimers.clear();
    this.tracks.forEach((track) => {
      track.pause();
      track.remove();
    });
    this.tracks.clear();
    void this.context?.close();
    this.context = null;
  }
}
