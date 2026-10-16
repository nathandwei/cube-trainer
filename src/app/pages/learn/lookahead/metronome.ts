/** How far ahead clicks are queued, and how often the queue is topped up. */
const LOOKAHEAD_S = 0.2;
const TOP_UP_MS = 50;
const FIRST_CLICK_DELAY_S = 0.05;

/**
 * A short click on every beat through Web Audio. Clicks are scheduled on the audio clock a little ahead of time,
 * so a timer that fires late never makes the beat drift.
 */
export class Metronome {
  #context: AudioContext | null = null;
  #timer: number | undefined;

  start(bpm: number): void {
    if (!(bpm > 0)) throw new RangeError(`bpm must be positive, got ${bpm}`);
    this.stop();
    const context = new AudioContext();
    this.#context = context;
    context.resume().catch((error: unknown) => console.warn("The metronome's audio did not start", error));
    const beat = 60 / bpm;
    let next = context.currentTime + FIRST_CLICK_DELAY_S;
    const topUp = () => {
      while (next < context.currentTime + LOOKAHEAD_S) {
        click(context, next);
        next += beat;
      }
    };
    topUp();
    this.#timer = window.setInterval(topUp, TOP_UP_MS);
  }

  stop(): void {
    window.clearInterval(this.#timer);
    this.#timer = undefined;
    const context = this.#context;
    this.#context = null;
    context?.close().catch((error: unknown) => console.warn("Could not close the metronome's audio", error));
  }
}

function click(context: AudioContext, at: number): void {
  const tone = context.createOscillator();
  const gain = context.createGain();
  tone.frequency.value = 1200;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.2, at + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
  tone.connect(gain).connect(context.destination);
  tone.start(at);
  tone.stop(at + 0.06);
}
