// Forgiving answer matching: "1/2" = "0.5", "3 r 2" = "3R2", "x = 5" = "5", "2, 3" = "3,2" (sets).

const UNIT_WORDS = /\b(square|sq|cubic|units?|cm|mm|km|m|inch(es)?|in|feet|foot|ft|yards?|yd|miles?|mi|dollars?|cents?|degrees?|hours?|minutes?|seconds?|days?|pounds?|lbs?|ounces?|oz|grams?|g|kg|liters?|l|ml)\b/g;

function toNumber(s: string): number | null {
  const mixed = s.match(/^(-?\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    const w = Number(mixed[1]);
    const f = Number(mixed[2]) / Number(mixed[3]);
    return w < 0 ? w - f : w + f;
  }
  const frac = s.match(/^(-?\d+)\/(\d+)$/);
  if (frac) return Number(frac[2]) === 0 ? null : Number(frac[1]) / Number(frac[2]);
  if (/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return Number(s);
  return null;
}

/** Canonical form of one answer token. Numbers become a rounded number string. */
function canon(raw: string): string {
  let s = raw.toLowerCase().trim();
  // equations: treat ÷ and / alike, × x * alike, and the typographic minus as a hyphen
  s = s.replace(/÷/g, '/').replace(/×/g, '*').replace(/(\d)\s*x\s*(?=\d)/g, '$1*').replace(/[−–]/g, '-');
  s = s.replace(/^[a-z]\s*=\s*/, ''); // "x = 5"
  s = s.replace(/[$,]/g, '').replace(/%/g, '').replace(/[“”"']/g, '');
  const stripped = s.replace(UNIT_WORDS, ' ').replace(/\s+/g, ' ').trim();
  s = stripped || s.replace(/\s+/g, ' ').trim(); // an answer that is only a unit-like word ("m") stays
  s = s.replace(/\s*r\s*(\d+)$/, 'r$1'); // remainders: "3 r 2" -> "3r2"
  const n = toNumber(s);
  if (n !== null && Number.isFinite(n)) return String(Math.round(n * 1e9) / 1e9);
  return s.replace(/\s+/g, '');
}

/** "2, 3 and 4" -> ["2","3","4"]; a single value stays a single item. */
function items(raw: string): string[] {
  const s = raw.trim().replace(/(\d),(?=\d{3}(?!\d))/g, '$1'); // thousands commas are not list commas
  if (/^-?\d+\s+\d+\/\d+$/.test(s)) return [s]; // mixed number, not a list
  const parts = s.split(/\s*(?:,|;|\band\b|\s)\s*/i).filter(Boolean);
  // a bare "1 / 2" or "3 r 2" is one value, not a list
  if (parts.length > 1 && /^\d+\s*\/\s*\d+$/.test(s)) return [s.replace(/\s/g, '')];
  if (/^\d+\s*r\s*\d+$/i.test(s)) return [s];
  return parts;
}

const SUP: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' };
const primeQ = (n: number) => { if (n < 2) return false; for (let d = 2; d * d <= n; d++) if (n % d === 0) return false; return true; };

/** "2^2×3×5", "2²·3·5", "2x2x3x5" -> sorted prime powers "2^2*3^1*5^1"; null if it isn't a product of primes. */
export function primeFactorKey(raw: string): string | null {
  let s = raw.trim().replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (m) => '^' + [...m].map((c) => SUP[c]).join(''));
  s = s.replace(/\s+/g, '').replace(/[×xX·*]/g, '*');
  if (!/^\d+(\^\d+)?(\*\d+(\^\d+)?)*$/.test(s)) return null;
  const pow = new Map<number, number>();
  for (const term of s.split('*')) {
    const [b, e = '1'] = term.split('^');
    const base = Number(b), exp = Number(e);
    if (!primeQ(base) || exp < 1) return null;
    pow.set(base, (pow.get(base) ?? 0) + exp);
  }
  return [...pow].sort((a, b) => a[0] - b[0]).map(([b, e]) => `${b}^${e}`).join('*');
}
const looksLikeFactorization = (a: string) => /[×*^⁰¹²³⁴⁵⁶⁷⁸⁹]/.test(a) && primeFactorKey(a) !== null;

/** "1×30, 2×15" -> "1,30|2,15" (sorted); null unless every item is a pair of whole numbers. */
export function pairListKey(raw: string): string | null {
  const items = raw.split(/[,;]/).map((t) => t.trim()).filter(Boolean);
  if (items.length < 1) return null;
  const pairs: string[] = [];
  for (const it of items) {
    const m = it.match(/^(\d+)\s*(?:[×xX*&]|and)\s*(\d+)$/);
    if (!m) return null;
    pairs.push([Number(m[1]), Number(m[2])].sort((a, b) => a - b).join(','));
  }
  return pairs.sort().join('|');
}

export function checkAnswer(input: string, accepted: string[]): boolean {
  const given = input.trim();
  if (!given) return false;
  // prime factorizations: any order, with or without exponents, but every base must be prime
  for (const a of accepted) if (looksLikeFactorization(a) && primeFactorKey(given) === primeFactorKey(a)) return true;
  if (accepted.length && accepted.every(looksLikeFactorization)) return false;
  // lists of pairs ("1×30, 2×15" or "13 & 31, 17 & 71"): any order, either way round
  for (const a of accepted) { const k = pairListKey(a); if (k && pairListKey(given) === k) return true; }
  if (accepted.length && accepted.every((a) => pairListKey(a))) return false;
  const gc = canon(given);
  if (accepted.some((a) => canon(a) === gc)) return true;
  // a number followed by plain words ("55 pairs", "35 buses") counts when the answer is that number
  const lead = given.match(/^(-?[\d.,/]+)\s+[a-z][a-z\s'’-]*$/i);
  if (lead && accepted.some((a) => toNumber(canon(a)) !== null && canon(a) === canon(lead[1]))) return true;
  // order-independent list answers
  const gi = items(given).map(canon).sort().join('|');
  return accepted.some((a) => {
    const ai = items(a);
    return ai.length > 1 && ai.map(canon).sort().join('|') === gi;
  });
}
