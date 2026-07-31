(() => {
  'use strict';

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const random = (a, b) => a + Math.random() * (b - a);

  const MATERIAL = {
    grass:   { noise: 'brown', hp: 170, lp: 1900, tone: 108, decay: .075, grit: .80 },
    dirt:    { noise: 'brown', hp: 120, lp: 1350, tone: 82,  decay: .090, grit: .88 },
    sand:    { noise: 'pink',  hp: 620, lp: 4600, tone: 165, decay: .100, grit: .66 },
    snow:    { noise: 'pink',  hp: 310, lp: 2400, tone: 116, decay: .125, grit: .44 },
    stone:   { noise: 'white', hp: 410, lp: 3500, tone: 158, decay: .068, grit: .55 },
    brick:   { noise: 'white', hp: 500, lp: 4100, tone: 194, decay: .073, grit: .50 },
    wood:    { noise: 'brown', hp: 190, lp: 2250, tone: 134, decay: .095, grit: .52 },
    leaves:  { noise: 'pink',  hp: 900, lp: 6800, tone: 250, decay: .110, grit: .80 },
    wool:    { noise: 'pink',  hp: 150, lp: 1100, tone: 72,  decay: .120, grit: .34 },
    glass:   { noise: 'white', hp: 1550,lp: 9800, tone: 1250,decay: .130, grit: .31 },
    metal:   { noise: 'white', hp: 800, lp: 7600, tone: 520, decay: .170, grit: .29 },
    crystal: { noise: 'white', hp: 1100,lp: 9800, tone: 860, decay: .190, grit: .26 },
    cactus:  { noise: 'pink',  hp: 470, lp: 4200, tone: 188, decay: .090, grit: .58 },
  };

  class VoxelAudio {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.effects = null;
      this.ambient = null;
      this.noiseBuffers = Object.create(null);
      this.windGain = null;
      this.caveGain = null;
      this.windFilter = null;
      this.caveFilter = null;
      this.settings = { masterVolume: .8, effectsVolume: .85, ambientVolume: .42, mute: false };
      this.lastStepAt = 0;
    }

    ensure() {
      if (this.ctx) return this.ctx;
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      const ctx = new AudioContextClass({ latencyHint: 'interactive' });
      this.ctx = ctx;
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.knee.value = 18;
      compressor.ratio.value = 5;
      compressor.attack.value = .002;
      compressor.release.value = .14;
      this.master = ctx.createGain();
      this.effects = ctx.createGain();
      this.ambient = ctx.createGain();
      this.effects.connect(this.master);
      this.ambient.connect(this.master);
      this.master.connect(compressor);
      compressor.connect(ctx.destination);
      this.noiseBuffers.white = this.makeNoise('white', 2.5);
      this.noiseBuffers.pink = this.makeNoise('pink', 2.5);
      this.noiseBuffers.brown = this.makeNoise('brown', 2.5);
      this.makeAmbience();
      this.applySettings();
      return ctx;
    }

    async unlock() {
      const ctx = this.ensure();
      if (!ctx) return false;
      if (ctx.state === 'suspended') {
        try { await ctx.resume(); } catch { return false; }
      }
      return ctx.state === 'running';
    }

    configure(settings) {
      if (!settings) return;
      this.settings.masterVolume = clamp(Number(settings.masterVolume ?? 80) / 100, 0, 1);
      this.settings.effectsVolume = clamp(Number(settings.effectsVolume ?? 85) / 100, 0, 1);
      this.settings.ambientVolume = clamp(Number(settings.ambientVolume ?? 42) / 100, 0, 1);
      this.settings.mute = Boolean(settings.mute);
      this.applySettings();
    }

    applySettings() {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const master = this.settings.mute ? 0 : Math.pow(this.settings.masterVolume, 1.35);
      this.master.gain.setTargetAtTime(master, now, .02);
      this.effects.gain.setTargetAtTime(Math.pow(this.settings.effectsVolume, 1.25), now, .02);
      this.ambient.gain.setTargetAtTime(Math.pow(this.settings.ambientVolume, 1.5), now, .08);
    }

    makeNoise(kind, seconds) {
      const length = Math.ceil(this.ctx.sampleRate * seconds);
      const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let brown = 0;
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        if (kind === 'brown') {
          brown = (brown + .021 * white) / 1.021;
          data[i] = clamp(brown * 3.45, -1, 1);
        } else if (kind === 'pink') {
          b0 = .99886 * b0 + white * .0555179;
          b1 = .99332 * b1 + white * .0750759;
          b2 = .969 * b2 + white * .153852;
          b3 = .8665 * b3 + white * .3104856;
          b4 = .55 * b4 + white * .5329522;
          b5 = -.7616 * b5 - white * .016898;
          data[i] = clamp((b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * .5362) * .105, -1, 1);
          b6 = white * .115926;
        } else data[i] = white;
      }
      return buffer;
    }

    panNode(pan = 0) {
      if (!this.ctx.createStereoPanner) return null;
      const node = this.ctx.createStereoPanner();
      node.pan.value = clamp(pan, -1, 1);
      return node;
    }

    connect(node, destination = this.effects, pan = 0) {
      const panner = this.panNode(pan);
      if (panner) { node.connect(panner); panner.connect(destination); }
      else node.connect(destination);
    }

    envelope(param, start, peak, duration, attack = .002) {
      param.cancelScheduledValues(start);
      param.setValueAtTime(.0001, start);
      param.exponentialRampToValueAtTime(Math.max(.0002, peak), start + attack);
      param.exponentialRampToValueAtTime(.0001, start + attack + duration);
    }

    tone(frequency, endFrequency, duration, gain, type = 'triangle', delay = 0, pan = 0) {
      const ctx = this.ensure();
      if (!ctx) return;
      const start = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(20, frequency), start);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
      this.envelope(amp.gain, start, gain, duration);
      osc.connect(amp);
      this.connect(amp, this.effects, pan);
      osc.start(start);
      osc.stop(start + duration + .03);
    }

    burst(kind, duration, gain, hp, lp, delay = 0, pan = 0) {
      const ctx = this.ensure();
      if (!ctx) return;
      const start = ctx.currentTime + delay;
      const source = ctx.createBufferSource();
      const high = ctx.createBiquadFilter();
      const low = ctx.createBiquadFilter();
      const amp = ctx.createGain();
      source.buffer = this.noiseBuffers[kind] || this.noiseBuffers.white;
      source.playbackRate.value = random(.84, 1.17);
      high.type = 'highpass'; high.frequency.value = hp; high.Q.value = .45;
      low.type = 'lowpass'; low.frequency.value = lp; low.Q.value = .35;
      this.envelope(amp.gain, start, gain, duration, .0015);
      source.connect(high); high.connect(low); low.connect(amp);
      this.connect(amp, this.effects, pan);
      source.start(start, random(0, 1.3));
      source.stop(start + duration + .03);
    }

    impact(material = 'stone', mode = 'step', strength = 1, delay = 0, pan = 0) {
      const p = MATERIAL[material] || MATERIAL.stone;
      const pitch = random(.88, 1.14);
      const base = mode === 'break' ? .12 : mode === 'place' ? .105 : .076;
      const duration = p.decay * (mode === 'break' ? 1.2 : mode === 'place' ? .84 : .73);
      this.burst(p.noise, duration, base * p.grit * strength, p.hp * pitch, p.lp * pitch, delay, pan);
      this.tone(p.tone * pitch, p.tone * pitch * (mode === 'break' ? .56 : .72), duration, base * .52 * strength,
        ['glass', 'metal', 'crystal'].includes(material) ? 'sine' : 'triangle', delay, pan);
      if (material === 'wood') this.tone(335 * pitch, 205 * pitch, .046, .035 * strength, 'square', delay + .004, pan);
      if (material === 'glass') this.tone(1660 * pitch, 1080 * pitch, .12, .036 * strength, 'sine', delay + .004, pan);
      if (material === 'metal') this.tone(735 * pitch, 680 * pitch, .18, .04 * strength, 'sine', delay + .003, pan);
      if (material === 'crystal') this.tone(1050 * pitch, 760 * pitch, .21, .045 * strength, 'sine', delay + .003, pan);
    }

    step(material = 'grass', sprinting = false) {
      const now = performance.now();
      if (now - this.lastStepAt < 90) return;
      this.lastStepAt = now;
      const strength = sprinting ? 1.12 : .9;
      this.impact(material, 'step', strength, 0, random(-.14, .14));
      if (material === 'grass' || material === 'leaves') this.burst('pink', .055, .025 * strength, 1600, 7400, .018, random(-.18, .18));
    }

    place(material = 'stone') {
      this.impact(material, 'place', 1, 0, random(-.1, .1));
      this.impact(material, 'place', .38, .035, random(-.08, .08));
    }

    break(material = 'stone') {
      const count = material === 'glass' ? 6 : material === 'leaves' ? 5 : 4;
      for (let i = 0; i < count; i++) this.impact(material, 'break', 1 - i * .105, i * random(.023, .041), random(-.25, .25));
      if (material === 'glass') {
        for (let i = 0; i < 5; i++) this.tone(random(1350, 3100), random(700, 1700), random(.06, .15), random(.013, .025), 'sine', random(.025, .15), random(-.5, .5));
      }
    }

    jump() {
      this.burst('brown', .068, .052, 75, 900);
      this.tone(92, 138, .1, .045, 'triangle');
    }

    land(intensity = .5, material = 'grass') {
      const hit = clamp(intensity, .18, 1.35);
      this.impact(material, 'step', .72 + hit * .62, 0, random(-.08, .08));
      this.burst('brown', .085 + hit * .045, .055 * hit, 35, 520);
      this.tone(74, 42, .09 + hit * .03, .05 * hit, 'sine');
    }

    pickup() {
      this.tone(720, 1080, .055, .055, 'square', 0, -.08);
      this.tone(940, 1380, .065, .045, 'square', .055, .08);
    }

    hotbar() {
      this.burst('white', .025, .025, 800, 4600);
      this.tone(380, 325, .038, .023, 'square');
    }

    uiClick(soft = false) {
      this.burst('white', .018, soft ? .012 : .022, 650, 5200);
      this.tone(soft ? 310 : 360, soft ? 280 : 305, .035, soft ? .018 : .028, 'square');
    }

    inventory(opening) {
      const a = opening ? 250 : 360;
      const b = opening ? 440 : 230;
      this.burst('pink', .11, .038, 550, 5200);
      this.tone(a, b, .105, .038, 'triangle');
      this.tone(a * 1.5, b * 1.35, .08, .018, 'sine', .025);
    }

    flight(enabled) {
      const notes = enabled ? [330, 494, 660] : [660, 494, 294];
      notes.forEach((f, i) => this.tone(f, f * (enabled ? 1.06 : .94), .12, .035, 'triangle', i * .055, (i - 1) * .12));
      this.burst('pink', .18, .024, 600, 6300);
    }

    error() { this.tone(170, 118, .14, .05, 'square'); }

    worldEnter() {
      [196, 247, 294, 392].forEach((f, i) => this.tone(f, f * 1.015, .26, .022, 'sine', i * .07, (i - 1.5) * .08));
      this.burst('pink', .42, .02, 900, 7100);
    }

    makeAmbience() {
      const wind = this.ctx.createBufferSource();
      const cave = this.ctx.createBufferSource();
      this.windFilter = this.ctx.createBiquadFilter();
      this.caveFilter = this.ctx.createBiquadFilter();
      this.windGain = this.ctx.createGain();
      this.caveGain = this.ctx.createGain();
      wind.buffer = this.noiseBuffers.pink; wind.loop = true;
      cave.buffer = this.noiseBuffers.brown; cave.loop = true;
      this.windFilter.type = 'bandpass'; this.windFilter.frequency.value = 1400; this.windFilter.Q.value = .55;
      this.caveFilter.type = 'lowpass'; this.caveFilter.frequency.value = 230; this.caveFilter.Q.value = 1.2;
      this.windGain.gain.value = .0001; this.caveGain.gain.value = .0001;
      wind.connect(this.windFilter); this.windFilter.connect(this.windGain); this.windGain.connect(this.ambient);
      cave.connect(this.caveFilter); this.caveFilter.connect(this.caveGain); this.caveGain.connect(this.ambient);
      wind.start(0, random(0, 1)); cave.start(0, random(0, 1));
    }

    updateAmbience({ active = false, altitude = 20, surface = 20, speed = 0, flying = false } = {}) {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const above = altitude - surface;
      const underground = surface - altitude;
      const moving = clamp(speed / 14, 0, 1);
      const wind = active ? clamp(.004 + Math.max(0, above) * .0011 + moving * .012 + (flying ? .008 : 0), .002, .06) : .0001;
      const cave = active ? clamp((underground - 2) * .004, .0001, .055) : .0001;
      this.windGain.gain.setTargetAtTime(wind, now, .35);
      this.caveGain.gain.setTargetAtTime(cave, now, .45);
      this.windFilter.frequency.setTargetAtTime(1100 + clamp(above, 0, 35) * 32 + moving * 900, now, .3);
      this.caveFilter.frequency.setTargetAtTime(180 + clamp(underground, 0, 20) * 9, now, .4);
    }

    preview() {
      this.unlock().then(() => {
        this.impact('grass', 'step', .9, 0, -.28);
        this.impact('wood', 'place', .95, .12, -.08);
        this.impact('stone', 'break', .85, .24, .08);
        this.impact('glass', 'break', .75, .38, .28);
        setTimeout(() => this.pickup(), 520);
      });
    }
  }

  window.VoxelAudio = VoxelAudio;
})();
