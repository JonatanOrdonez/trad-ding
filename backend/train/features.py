import pandas as pd

FEATURES = ["sma_7", "sma_20", "rsi", "macd", "macd_signal", "volume_change", "price_change"]


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    df["sma_7"] = df["Close"].rolling(window=7).mean()
    df["sma_20"] = df["Close"].rolling(window=20).mean()

    delta = df["Close"].diff()
    gain = delta.clip(lower=0).rolling(window=14).mean()
    loss = -delta.clip(upper=0).rolling(window=14).mean()
    rs = gain / loss
    df["rsi"] = 100 - (100 / (1 + rs))

    ema_12 = df["Close"].ewm(span=12, adjust=False).mean()
    ema_26 = df["Close"].ewm(span=26, adjust=False).mean()
    df["macd"] = ema_12 - ema_26
    df["macd_signal"] = df["macd"].ewm(span=9, adjust=False).mean()

    df["volume_change"] = df["Volume"].pct_change()
    df["price_change"] = df["Close"].pct_change()
    df["label"] = (df["Close"].shift(-1) > df["Close"]).astype(int)

    df.dropna(inplace=True)
    return df


def compute_balanced_accuracy(df: pd.DataFrame) -> float:
    signals = ((df["macd"] > df["macd_signal"]) & (df["rsi"] < 70)).astype(int)
    labels = df["label"]

    true_positives = ((signals == 1) & (labels == 1)).sum()
    actual_positives = (labels == 1).sum()
    true_negatives = ((signals == 0) & (labels == 0)).sum()
    actual_negatives = (labels == 0).sum()

    sensitivity = true_positives / actual_positives if actual_positives > 0 else 0.0
    specificity = true_negatives / actual_negatives if actual_negatives > 0 else 0.0

    return round(float((sensitivity + specificity) / 2), 4)
