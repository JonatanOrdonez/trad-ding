// Technical indicator feature engineering — TypeScript port of modal/features.py

export type OHLCVRecord = {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type FeatureRow = {
  sma_ratio: number;
  price_to_sma20: number;
  rsi: number;
  rsi_change: number;
  macd_hist: number;
  bb_position: number;
  atr_ratio: number;
  volume_ratio: number;
  obv_change: number;
  price_change: number;
  price_change_5d: number;
  high_low_range: number;
  trend_strength: number;
  vol_regime: number;
  mean_rev_dist: number;
  rsi_zone: number;
  consecutive_up: number;
};

export const FEATURES = [
  "sma_ratio",
  "price_to_sma20",
  "rsi",
  "rsi_change",
  "macd_hist",
  "bb_position",
  "atr_ratio",
  "volume_ratio",
  "obv_change",
  "price_change",
  "price_change_5d",
  "high_low_range",
  "trend_strength",
  "vol_regime",
  "mean_rev_dist",
  "rsi_zone",
  "consecutive_up",
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

function rollingStd(values: number[], window: number): number[] {
  const means = sma(values, window);
  const result = new Array<number>(values.length).fill(NaN);
  for (let i = window - 1; i < values.length; i++) {
    let sumSq = 0;
    for (let j = i - window + 1; j <= i; j++) {
      sumSq += (values[j] - means[i]) ** 2;
    }
    result[i] = Math.sqrt(sumSq / (window - 1));
  }
  return result;
}

// EMA with adjust=False (recursive), matches pandas ewm(span, adjust=False)
function ema(values: number[], span: number): number[] {
  const k = 2 / (span + 1);
  const result = new Array<number>(values.length).fill(NaN);
  let firstValid = -1;
  for (let i = 0; i < values.length; i++) {
    if (!Number.isNaN(values[i])) {
      firstValid = i;
      break;
    }
  }
  if (firstValid === -1) return result;
  result[firstValid] = values[firstValid];
  for (let i = firstValid + 1; i < values.length; i++) {
    if (Number.isNaN(values[i])) {
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

  const gains = delta.map((d) => (Number.isNaN(d) ? NaN : Math.max(d, 0)));
  const losses = delta.map((d) => (Number.isNaN(d) ? NaN : Math.max(-d, 0)));

  const avgGains = sma(gains, period);
  const avgLosses = sma(losses, period);

  return avgGains.map((ag, i) => {
    if (Number.isNaN(ag) || Number.isNaN(avgLosses[i])) return NaN;
    const rs = avgLosses[i] === 0 ? Infinity : ag / avgLosses[i];
    return 100 - 100 / (1 + rs);
  });
}

function pctChange(values: number[], period = 1): number[] {
  const result = new Array<number>(values.length).fill(NaN);
  for (let i = period; i < values.length; i++) {
    result[i] =
      values[i - period] === 0
        ? NaN
        : (values[i] - values[i - period]) / values[i - period];
  }
  return result;
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function buildFeatures(data: OHLCVRecord[]): FeatureRow[] {
  if (data.length < 60) return [];

  const closes = data.map((d) => d.close);
  const highs = data.map((d) => d.high);
  const lows = data.map((d) => d.low);
  const volumes = data.map((d) => d.volume);

  // ── Trend ───────────────────────────────────────────────────────────────
  const sma7 = sma(closes, 7);
  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50);
  const smaRatio = sma7.map((s7, i) => s7 / sma20[i]);
  const priceToSma20 = closes.map((c, i) => c / sma20[i]);

  // ── RSI ─────────────────────────────────────────────────────────────────
  const rsiValues = rsiCalc(closes, 14);
  const rsiChange = new Array<number>(closes.length).fill(NaN);
  for (let i = 1; i < rsiValues.length; i++) {
    rsiChange[i] = rsiValues[i] - rsiValues[i - 1];
  }

  // ── MACD (normalized) ───────────────────────────────────────────────────
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macd = ema12.map((e, i) =>
    Number.isNaN(e) || Number.isNaN(ema26[i]) ? NaN : e - ema26[i],
  );
  const macdSignal = ema(macd, 9);
  const macdHist = macd.map((m, i) =>
    Number.isNaN(m) || Number.isNaN(macdSignal[i]) || closes[i] === 0
      ? NaN
      : (m - macdSignal[i]) / closes[i],
  );

  // ── Bollinger Bands ─────────────────────────────────────────────────────
  const std20 = rollingStd(closes, 20);
  const bbPosition = closes.map((c, i) => {
    if (Number.isNaN(sma20[i]) || Number.isNaN(std20[i])) return NaN;
    const upper = sma20[i] + 2 * std20[i];
    const lower = sma20[i] - 2 * std20[i];
    const range = upper - lower;
    return range > 0 ? (c - lower) / range : 0.5;
  });

  // ── ATR (normalized) ───────────────────────────────────────────────────
  const trueRange = new Array<number>(closes.length).fill(NaN);
  for (let i = 1; i < closes.length; i++) {
    const hl = highs[i] - lows[i];
    const hc = Math.abs(highs[i] - closes[i - 1]);
    const lc = Math.abs(lows[i] - closes[i - 1]);
    trueRange[i] = Math.max(hl, hc, lc);
  }
  const atr = sma(trueRange, 14);
  const atrRatio = atr.map((a, i) => (closes[i] === 0 ? NaN : a / closes[i]));

  // ── Volume ──────────────────────────────────────────────────────────────
  const volumeSma20 = sma(volumes, 20);
  const volumeRatioArr = volumes.map((v, i) =>
    Number.isNaN(volumeSma20[i]) || volumeSma20[i] === 0 ? NaN : v / volumeSma20[i],
  );

  // ── OBV ─────────────────────────────────────────────────────────────────
  const obv = new Array<number>(closes.length).fill(NaN);
  obv[0] = 0;
  for (let i = 1; i < closes.length; i++) {
    const dir = closes[i] > closes[i - 1] ? 1 : closes[i] < closes[i - 1] ? -1 : 0;
    obv[i] = obv[i - 1] + volumes[i] * dir;
  }
  const obvChange = pctChange(obv);

  // ── Price changes ───────────────────────────────────────────────────────
  const priceChangeArr = pctChange(closes);
  const priceChange5d = pctChange(closes, 5);
  const highLowRange = highs.map((h, i) =>
    closes[i] === 0 ? NaN : (h - lows[i]) / closes[i],
  );

  // ── Context features ────────────────────────────────────────────────────
  const trendStrength = smaRatio.map((sr) => Math.abs(sr - 1));
  const atrRatioSma = sma(atrRatio, 20);
  const volRegime = atrRatio.map((ar, i) =>
    Number.isNaN(atrRatioSma[i]) || atrRatioSma[i] === 0 ? NaN : ar / atrRatioSma[i],
  );
  const meanRevDist = closes.map((c, i) =>
    Number.isNaN(sma50[i]) || c === 0 ? NaN : (c - sma50[i]) / c,
  );
  const rsiZone = rsiValues.map((r) => {
    if (Number.isNaN(r)) return NaN;
    return r < 30 ? 0 : r > 70 ? 2 : 1;
  });

  // Consecutive up days (capped at 5)
  const consecutiveUp = new Array<number>(closes.length).fill(NaN);
  consecutiveUp[0] = 0;
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) {
      consecutiveUp[i] = Math.min((consecutiveUp[i - 1] || 0) + 1, 5);
    } else {
      consecutiveUp[i] = 0;
    }
  }

  // ── Build rows ────────────────────────────────────────────────────────
  const rows: FeatureRow[] = [];
  for (let i = 0; i < data.length; i++) {
    const vals = [
      smaRatio[i], priceToSma20[i], rsiValues[i], rsiChange[i],
      macdHist[i], bbPosition[i], atrRatio[i], volumeRatioArr[i],
      obvChange[i], priceChangeArr[i], priceChange5d[i], highLowRange[i],
      trendStrength[i], volRegime[i], meanRevDist[i], rsiZone[i],
      consecutiveUp[i],
    ];

    if (vals.some((v) => Number.isNaN(v) || !Number.isFinite(v))) continue;

    rows.push({
      sma_ratio: smaRatio[i],
      price_to_sma20: priceToSma20[i],
      rsi: rsiValues[i],
      rsi_change: rsiChange[i],
      macd_hist: macdHist[i],
      bb_position: bbPosition[i],
      atr_ratio: atrRatio[i],
      volume_ratio: volumeRatioArr[i],
      obv_change: obvChange[i],
      price_change: priceChangeArr[i],
      price_change_5d: priceChange5d[i],
      high_low_range: highLowRange[i],
      trend_strength: trendStrength[i],
      vol_regime: volRegime[i],
      mean_rev_dist: meanRevDist[i],
      rsi_zone: rsiZone[i],
      consecutive_up: consecutiveUp[i],
    });
  }
  return rows;
}
