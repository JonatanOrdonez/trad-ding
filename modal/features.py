import pandas as pd
import numpy as np

FEATURES = [
    "sma_ratio",        # sma_7 / sma_20 — trend direction
    "price_to_sma20",   # close / sma_20 — mean reversion
    "rsi",              # RSI(14) — momentum oscillator
    "rsi_change",       # rsi - rsi(prev) — RSI momentum
    "macd_hist",        # (macd - signal) / close — normalized MACD histogram
    "bb_position",      # (close - bb_lower) / (bb_upper - bb_lower) — Bollinger position
    "atr_ratio",        # ATR(14) / close — normalized volatility
    "volume_ratio",     # volume / volume_sma(20) — relative volume
    "obv_change",       # OBV pct change — volume-price agreement
    "price_change",     # 1-day return
    "price_change_5d",  # 5-day return
    "high_low_range",   # (high - low) / close — daily range
    # ── New context features ─────────────────────────────────────────────────
    "trend_strength",   # abs(sma_ratio - 1) — how strong the trend is
    "vol_regime",       # atr_ratio / atr_ratio_sma(20) — volatility relative to recent
    "mean_rev_dist",    # (close - sma_50) / close — distance from long-term mean
    "rsi_zone",         # 0=oversold(<30), 1=neutral, 2=overbought(>70)
    "consecutive_up",   # count of consecutive up days (capped at 5)
]

LABEL_HORIZON = 5       # predict 5 days forward
LABEL_THRESHOLD = 0.01  # 1% move


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    close = df["Close"]
    high = df["High"]
    low = df["Low"]
    volume = df["Volume"]

    # ── Trend ────────────────────────────────────────────────────────────────
    sma_7 = close.rolling(7).mean()
    sma_20 = close.rolling(20).mean()
    sma_50 = close.rolling(50).mean()
    df["sma_ratio"] = sma_7 / sma_20
    df["price_to_sma20"] = close / sma_20

    # ── RSI ──────────────────────────────────────────────────────────────────
    delta = close.diff()
    gain = delta.clip(lower=0).rolling(14).mean()
    loss = -delta.clip(upper=0).rolling(14).mean()
    rs = gain / loss
    rsi = 100 - (100 / (1 + rs))
    df["rsi"] = rsi
    df["rsi_change"] = rsi.diff()

    # ── MACD (normalized) ────────────────────────────────────────────────────
    ema_12 = close.ewm(span=12, adjust=False).mean()
    ema_26 = close.ewm(span=26, adjust=False).mean()
    macd = ema_12 - ema_26
    macd_signal = macd.ewm(span=9, adjust=False).mean()
    df["macd_hist"] = (macd - macd_signal) / close

    # ── Bollinger Bands ──────────────────────────────────────────────────────
    std_20 = close.rolling(20).std()
    bb_upper = sma_20 + 2 * std_20
    bb_lower = sma_20 - 2 * std_20
    bb_range = bb_upper - bb_lower
    df["bb_position"] = np.where(bb_range > 0, (close - bb_lower) / bb_range, 0.5)

    # ── ATR (normalized) ─────────────────────────────────────────────────────
    prev_close = close.shift(1)
    tr = pd.concat([
        high - low,
        (high - prev_close).abs(),
        (low - prev_close).abs(),
    ], axis=1).max(axis=1)
    atr = tr.rolling(14).mean()
    atr_ratio = atr / close
    df["atr_ratio"] = atr_ratio

    # ── Volume ───────────────────────────────────────────────────────────────
    volume_sma_20 = volume.rolling(20).mean()
    df["volume_ratio"] = volume / volume_sma_20

    # ── OBV ──────────────────────────────────────────────────────────────────
    direction = np.sign(close.diff())
    obv = (volume * direction).cumsum()
    df["obv_change"] = obv.pct_change()

    # ── Price changes ────────────────────────────────────────────────────────
    df["price_change"] = close.pct_change()
    df["price_change_5d"] = close.pct_change(5)
    df["high_low_range"] = (high - low) / close

    # ── Context features ─────────────────────────────────────────────────────
    df["trend_strength"] = (sma_7 / sma_20 - 1).abs()
    atr_ratio_sma = atr_ratio.rolling(20).mean()
    df["vol_regime"] = np.where(atr_ratio_sma > 0, atr_ratio / atr_ratio_sma, 1.0)
    df["mean_rev_dist"] = (close - sma_50) / close
    df["rsi_zone"] = np.where(rsi < 30, 0, np.where(rsi > 70, 2, 1)).astype(float)

    # Consecutive up days (capped at 5)
    up = (close.diff() > 0).astype(int)
    consecutive = up.copy()
    for i in range(1, len(consecutive)):
        if up.iloc[i] == 1:
            consecutive.iloc[i] = consecutive.iloc[i - 1] + 1
        else:
            consecutive.iloc[i] = 0
    df["consecutive_up"] = consecutive.clip(upper=5).astype(float)

    # ── Label: 5-day forward return > 1% ─────────────────────────────────────
    forward_return = close.shift(-LABEL_HORIZON) / close - 1
    df["label"] = (forward_return > LABEL_THRESHOLD).astype(int)

    df.replace([np.inf, -np.inf], np.nan, inplace=True)
    df.dropna(inplace=True)
    return df


def compute_balanced_accuracy(df: pd.DataFrame) -> float:
    signals = (
        (df["macd_hist"] > 0) & (df["rsi"] < 70) & (df["sma_ratio"] > 1)
    ).astype(int)
    labels = df["label"]

    true_positives = ((signals == 1) & (labels == 1)).sum()
    actual_positives = (labels == 1).sum()
    true_negatives = ((signals == 0) & (labels == 0)).sum()
    actual_negatives = (labels == 0).sum()

    sensitivity = true_positives / actual_positives if actual_positives > 0 else 0.0
    specificity = true_negatives / actual_negatives if actual_negatives > 0 else 0.0

    return round(float((sensitivity + specificity) / 2), 4)
