export function range(length: number): number[] {
  return ((new Array(length) as any).fill(null) as number[]).map((_, i) => i);
}

export function edges<T>(ts: T[]): [T | null, T | null][] {
  return range(ts.length + 1).map((i) => [ts[i - 1] || null, ts[i] || null]);
}

export function zip<T, U>(ts: T[], us: U[]): [T, U][] {
  return ts.map((t, i) => <[T, U]>[t, us[i]]);
}

export function never(x: never, msg?: string): never {
  throw new Error(msg ?? "Unexpected object: " + x);
}

export function __isSMI(n: number): boolean {
  // Checks if a number is within the "small integer" range
  //  that V8 uses on 64-bit platforms to efficiently represent
  //  small ints. Keeping numbers within this range _should_
  //  lead to better perf esp. for arrays.
  return -(2 ** 31) < n && n < 2 ** 31 - 1;
}

export function isString(val: any): val is string {
  return typeof val === "string";
}

export function hashCode(s: string) {
  var hash = 0,
    i,
    chr;
  if (s.length === 0) return hash;
  for (i = 0; i < s.length; i++) {
    chr = s.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
    // TODO: is the next line necessary?
    hash >>>= 0; // Convert to unsigned
  }
  return hash;
}

export function objMap<A, V1 extends A[keyof A], V2>(
  a: A,
  map: (v1: V1, n: keyof A) => V2
): { [P in keyof A]: V2 } {
  const res: { [k: string]: V2 } = {};
  Object.entries(a).forEach(([n, v1]) => {
    res[n] = map(v1, n as keyof A);
  });
  return res as { [P in keyof A]: V2 };
}
export function toRecord<A, V>(
  as: A[],
  key: (a: A) => string,
  val: (a: A) => V
): { [k: string]: V } {
  const res: { [k: string]: V } = {};
  as.forEach((a) => (res[key(a)] = val(a)));
  return res;
}

// TODO(@darzu): this is is a typescript hack for the fact that just using "false"
//  causes type inference (specifically type narrowing) to not work right in
//  dead code sometimes (last tested with tsc v4.2.3)
export const FALSE: boolean = false;

export type NumberTuple<ES> = { [_ in keyof ES]: number };

let _logOnceKeys: Set<string> = new Set();
export function logOnce(key: string, msg?: string) {
  if (!_logOnceKeys.has(key)) {
    _logOnceKeys.add(key);
    console.log(msg ?? key);
  }
}
