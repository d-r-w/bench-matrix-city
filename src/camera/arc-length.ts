// Arc-length parameterized curve wrapper for THREE.CatmullRomCurve3
import * as THREE from "three";

/**
 * Pre-compute an arc-length lookup table so we can query points by
 * uniform distance along the curve rather than raw parametric t.
 */
export class ArcLengthCurve {
  private _table: number[]; // cumulative arc length at each sample index
  private _samples: THREE.Vector3[];

  constructor(curve: THREE.CatmullRomCurve3, samples = 2048) {
    this._samples = new Array(samples);
    const step = 1 / (samples - 1);

    let totalLength = 0;
    let prevPoint = curve.getPointAt(0);
    this._samples[0] = prevPoint.clone();

    for (let i = 1; i < samples; i++) {
      const point = curve.getPointAt(i * step);
      this._samples[i] = point;
      totalLength += point.distanceTo(prevPoint);
      prevPoint = point;
    }

    // Build cumulative length table (normalized to [0, 1])
    this._table = new Array(samples);
    let cumLength = 0;
    this._table[0] = 0;

    for (let i = 1; i < samples; i++) {
      cumLength += this._samples[i].distanceTo(this._samples[i - 1]);
      this._table[i] = cumLength / totalLength;
    }
  }

  /** Total arc length of the curve in world units. */
  get length(): number {
    // Reconstruct from last sample distance chain
    let len = 0;
    for (let i = 1; i < this._samples.length; i++) {
      len += this._samples[i].distanceTo(this._samples[i - 1]);
    }
    return len;
  }

  /** Get point at fraction f ∈ [0, 1] of total arc length. */
  getPointAt(f: number): THREE.Vector3 {
    const clamped = Math.max(0, Math.min(1, f));

    // Binary search for the right segment in the lookup table
    let low = 0;
    let high = this._table.length - 1;

    while (low < high - 1) {
      const mid = (low + high) >> 1;
      if (this._table[mid] > clamped) {
        high = mid;
      } else {
        low = mid;
      }
    }

    // Linear interpolation within the segment
    const segLength = this._table[high] - this._table[low];
    if (segLength < 1e-6) return this._samples[low].clone();

    const t = (clamped - this._table[low]) / segLength;
    return new THREE.Vector3().lerpVectors(this._samples[low], this._samples[high], t);
  }

  /** Get tangent direction at fraction f ∈ [0, 1]. */
  getTangentAt(f: number): THREE.Vector3 {
    const eps = 0.001;
    const p1 = this.getPointAt(Math.max(0, f - eps));
    const p2 = this.getPointAt(Math.min(1, f + eps));
    return new THREE.Vector3().subVectors(p2, p1).normalize();
  }

  /** Get curvature-based banking value at fraction f ∈ [0, 1]. */
  getBankingAt(f: number, scale = 0.5): number {
    const step = 0.002;
    const p1 = this.getPointAt(Math.max(0, f));
    const p2 = this.getPointAt(Math.min(1, f + step));
    const p3 = this.getPointAt(Math.min(1, f + step * 2));

    const v1 = new THREE.Vector3().subVectors(p2, p1).normalize();
    const v2 = new THREE.Vector3().subVectors(p3, p2).normalize();
    const cross = new THREE.Vector3().crossVectors(v1, v2);

    return Math.max(-0.3, Math.min(0.3, cross.y * scale));
  }
}
