// Technical indicator feature engineering — TypeScript port of backend/train/features.py

export type OHLCVRecord = { close: number; volume: number };

export type FeatureRow = {
  sma_7: number;
  sma_20: number;
  rsi: number;
  macd: number;
  macd_signal: number;
  volume_change: number;
  price_change: number;
};

export const FEATURES = [
  "sma_7",
  "sma_20",
  "rsi",
  "macd",
  "macd_signal",
  "volume_change",
  "price_change",
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function sma(values: number[], window: number): number[] {
  const result = new Array<number>(values.length).fill(NaN);
  for (let i = window - 1; i < values.length; i++) {
    let sum = 0;
    for (let j = i - window + 1; j <= i; j++) sum += values[j];
    result[i] = sum / window;
  }
  return result;
}

// EMA with adjust=False (recursive), matches pandas ewm(span, adjust=False)
function ema(values: number[], span: number): number[] {
  const k = 2 / (span + 1);
  const result = new Array<number>(values.length).fill(NaN);
  let firstValid = -1;
  for (let i = 0; i < values.length; i++) {
    if (!isNaN(values[i])) { firstValid = i; break; }
  }
  if (firstValid === -1) return result;
  result[firstValid] = values[firstValid];
  for (let i = firstValid + 1; i < values.length; i++) {
    if (isNaN(values[i])) {
      result[i] = NaN;
    } else {
      result[i] = values[i] * k + result[i - 1] * (1 - k);
    }
  }
  return result;
}

function rsiCalc(closes: number[], period = 14): number[] {
  const n = closes.length;
  const delta = new Array<number>(n).fill(NaN);
  for (let i = 1; i < n; i++) delta[i] = closes[i] - closes[i - 1];

  const gains = delta.map((d) => (isNaN(d) ? NaN : Math.max(d, 0)));
  const losses = delta.map((d) => (isNaN(d) ? NaN : Math.max(-d, 0)));

  const avgGains = sma(gains, period);
  const avgLosses = sma(losses, period);

  return avgGains.map((ag, i) => {
    if (isNaN(ag) || isNaN(avgLosses[i])) return NaN;
    const rs = avgLosses[i] === 0 ? Infinity : ag / avgLosses[i];
    return 100 - 100 / (1 + rs);
  });
}

function pctChange(values: number[]): number[] {
  const result = new Array<number>(values.length).fill(NaN);
  for (let i = 1; i < values.length; i++) {
    result[i] = values[i - 1] === 0 ? NaN : (values[i] - values[i - 1]) / values[i - 1];
  }
  return result;
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function buildFeatures(data: OHLCVRecord[]): FeatureRow[] {
  if (data.length < 30) return [];

  const closes = data.map((d) => d.close);
  const volumes = data.map((d) => d.volume);

  const sma7 = sma(closes, 7);
  const sma20 = sma(closes, 20);
  const rsiValues = rsiCalc(closes, 14);

  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macdValues = ema12.map((e, i) => (isNaN(e) || isNaN(ema26[i]) ? NaN : e - ema26[i]));
  const macdSignal = ema(macdValues, 9);

  const volumeChange = pctChange(volumes);
  const priceChange = pctChange(closes);

  const rows: FeatureRow[] = [];
  for (let i = 0; i < data.length; i++) {
    if (
      isNaN(sma7[i]) || isNaN(sma20[i]) || isNaN(rsiValues[i]) ||
      isNaN(macdValues[i]) || isNaN(macdSignal[i]) ||
      isNaN(volumeChange[i]) || isNaN(priceChange[i])
    ) continue;

    rows.push({
      sma_7: sma7[i],
      sma_20: sma20[i],
      rsi: rsiValues[i],
      macd: macdValues[i],
      macd_signal: macdSignal[i],
      volume_change: volumeChange[i],
      price_change: priceChange[i],
    });
  }
  return rows;
}
