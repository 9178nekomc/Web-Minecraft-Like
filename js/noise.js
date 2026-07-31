(() => {
  'use strict';

  class PerlinNoise {
    constructor(seed = 1337) {
      this.perm = new Uint8Array(512);
      const p = new Uint8Array(256);
      for (let i = 0; i < 256; i++) p[i] = i;
      let state = seed >>> 0;
      const rand = () => {
        state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
        return (state >>> 0) / 4294967296;
      };
      for (let i = 255; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        const t = p[i]; p[i] = p[j]; p[j] = t;
      }
      for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
    }

    fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    lerp(a, b, t) { return a + t * (b - a); }
    grad(hash, x, y, z) {
      const h = hash & 15;
      const u = h < 8 ? x : y;
      const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
      return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
    }

    noise3(x, y, z) {
      const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
      x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
      const u = this.fade(x), v = this.fade(y), w = this.fade(z);
      const p = this.perm;
      const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z;
      const B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
      return this.lerp(
        this.lerp(this.lerp(this.grad(p[AA], x, y, z), this.grad(p[BA], x - 1, y, z), u),
                  this.lerp(this.grad(p[AB], x, y - 1, z), this.grad(p[BB], x - 1, y - 1, z), u), v),
        this.lerp(this.lerp(this.grad(p[AA + 1], x, y, z - 1), this.grad(p[BA + 1], x - 1, y, z - 1), u),
                  this.lerp(this.grad(p[AB + 1], x, y - 1, z - 1), this.grad(p[BB + 1], x - 1, y - 1, z - 1), u), v), w
      );
    }

    noise2(x, y) { return this.noise3(x, y, 0.371); }
    fbm2(x, y, octaves = 4, lacunarity = 2, gain = .5) {
      let total = 0, amplitude = 1, frequency = 1, norm = 0;
      for (let i = 0; i < octaves; i++) {
        total += this.noise2(x * frequency, y * frequency) * amplitude;
        norm += amplitude; amplitude *= gain; frequency *= lacunarity;
      }
      return total / norm;
    }
  }

  window.PerlinNoise = PerlinNoise;
})();
