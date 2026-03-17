import io
import json
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import pandas as pd
import yfinance as yf
from groq import Groq
from app.config import get_yfinance_symbol
from app.db import get_session
from app.env import GROQ_API_KEY
from app.supabase import get_supabase
from app.repositories import assets as assets_repository
from app.repositories import asset_models as asset_models_repository

logger = logging.getLogger(__name__)

BUCKET = "ml-models"
FEATURES = ["sma_7", "sma_20", "rsi", "macd", "macd_signal", "volume_change", "price_change"]

_SYSTEM_PROMPT = """You are a quantitative trading analyst. Analyze historical price indicator
patterns and generate a trading strategy in JSON. Be precise and data-driven.
Respond exclusively with a valid JSON object."""

_TRAIN_PROMPT = """Analyze the following historical indicator statistics for {symbol} over the past year
and generate a trading strategy.

INDICATOR SUMMARY:
{summary}

BACKTEST BALANCED ACCURACY: {accuracy:.1%} (sensitivity + specificity / 2, measures BUY and SELL prediction quality equally)

Respond with a JSON object:
{{
  "strategy": "detailed description of when to BUY, SELL or HOLD based on the indicator patterns",
  "buy_conditions": ["list of specific indicator conditions that suggest BUY"],
  "sell_conditions": ["list of specific indicator conditions that suggest SELL"],
  "key_insights": ["list of key patterns found in the historical data"],
  "confidence": float between 0.0 and 1.0
}}"""


def _fetch_historical_data(symbol: str) -> pd.DataFrame:
    ticker = yf.Ticker(get_yfinance_symbol(symbol))
    df = ticker.history(period="1y")
    df.dropna(inplace=True)
    return df


def _build_features(df: pd.DataFrame) -> pd.DataFrame:
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


def _compute_balanced_accuracy(df: pd.DataFrame) -> float:
    signals = ((df["macd"] > df["macd_signal"]) & (df["rsi"] < 70)).astype(int)
    labels = df["label"]

    true_positives = ((signals == 1) & (labels == 1)).sum()
    actual_positives = (labels == 1).sum()
    true_negatives = ((signals == 0) & (labels == 0)).sum()
    actual_negatives = (labels == 0).sum()

    sensitivity = true_positives / actual_positives if actual_positives > 0 else 0.0
    specificity = true_negatives / actual_negatives if actual_negatives > 0 else 0.0

    return round(float((sensitivity + specificity) / 2), 4)


def _build_summary(df: pd.DataFrame) -> str:
    rsi_overbought = (df["rsi"] > 70).mean()
    rsi_oversold = (df["rsi"] < 30).mean()
    macd_positive = (df["macd"] > df["macd_signal"]).mean()
    price_above_sma20 = (df["Close"] > df["sma_20"]).mean()
    avg_daily_change = df["price_change"].mean()
    volatility = df["price_change"].std()

    return (
        f"RSI overbought (>70): {rsi_overbought:.1%} of days | "
        f"RSI oversold (<30): {rsi_oversold:.1%} of days | "
        f"MACD bullish: {macd_positive:.1%} of days | "
        f"Price above SMA20: {price_above_sma20:.1%} of days | "
        f"Avg daily change: {avg_daily_change:.3%} | "
        f"Volatility (std): {volatility:.3%}"
    )


def _generate_strategy(symbol: str, summary: str, accuracy: float) -> dict:
    client = Groq(api_key=GROQ_API_KEY, timeout=30.0)
    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": _TRAIN_PROMPT.format(
                symbol=symbol, summary=summary, accuracy=accuracy
            )},
        ],
        temperature=0.2,
        response_format={"type": "json_object"},
    )
    raw = response.choices[0].message.content
    if raw is None:
        raise ValueError("Empty response from Groq")
    return json.loads(raw)


def _upload_strategy(strategy: dict, symbol: str) -> str:
    client = get_supabase()
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
    path = f"{symbol}/{timestamp}-strategy.json"
    data = json.dumps(strategy).encode("utf-8")
    client.storage.from_(BUCKET).upload(
        path=path,
        file=data,
        file_options={"content-type": "application/json", "upsert": "true"},
    )
    return path


def train_asset(symbol: str) -> dict:
    session = get_session()
    try:
        asset = assets_repository.get_asset_by_symbol(session, symbol)
        if asset is None:
            raise ValueError(f"Asset with symbol {symbol} not found")

        logger.info(f"Fetching historical data for {symbol}")
        df = _fetch_historical_data(symbol)
        df = _build_features(df)

        balanced_accuracy = _compute_balanced_accuracy(df)
        summary = _build_summary(df)

        logger.info(f"Generating strategy for {symbol} via Groq")
        strategy = _generate_strategy(symbol, summary, balanced_accuracy)

        metrics = {"balanced_accuracy": balanced_accuracy, "confidence": strategy.get("confidence", 0)}

        active_model = asset_models_repository.get_active_model(session, asset.id)
        if active_model is not None:
            current_accuracy = active_model.metrics.get("balanced_accuracy", 0)
            if metrics["balanced_accuracy"] <= current_accuracy:
                logger.info(
                    f"New accuracy ({metrics['accuracy']}) is not better than "
                    f"current ({current_accuracy}). Discarding."
                )
                return {"improved": False, "metrics": metrics}

        logger.info(f"Uploading strategy for {symbol} to Supabase Storage")
        storage_path = _upload_strategy(strategy, symbol)

        asset_models_repository.deactivate_models(session, asset.id)
        asset_models_repository.create_asset_model(
            session,
            asset.id,
            storage_path,
            metrics,
            {"features": FEATURES, "period": "1y"},
        )

        logger.info(f"Strategy for {symbol} saved. Metrics: {metrics}")
        return {"improved": True, "metrics": metrics}
    finally:
        session.close()


def _train_asset_threadsafe(symbol: str) -> dict:
    try:
        return {"symbol": symbol, **train_asset(symbol)}
    except Exception as e:
        logger.error(f"Failed to train model for {symbol}: {e}")
        return {"symbol": symbol, "improved": False, "error": str(e)}


def train_all_assets() -> list[dict]:
    session = get_session()
    try:
        assets = assets_repository.get_assets(session)
    finally:
        session.close()

    with ThreadPoolExecutor() as executor:
        futures = [
            executor.submit(_train_asset_threadsafe, asset.symbol)
            for asset in assets
        ]
        return [future.result() for future in as_completed(futures)]
