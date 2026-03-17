import json
import logging
import yfinance as yf
from groq import Groq
from app.config import get_yfinance_symbol
from app.db import get_session
from app.env import GROQ_API_KEY
from app.supabase import get_supabase
from app.repositories import assets as assets_repository
from app.repositories import asset_models as asset_models_repository
from app.services.training import BUCKET, _build_features
from app.types.prediction import AssetPrediction

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """You are a quantitative trading analyst. Given a trading strategy and current
technical indicators, provide a precise trading signal. Respond exclusively with a valid JSON object."""

_PREDICT_PROMPT = """Given the following trading strategy and current indicator values for {symbol},
provide a trading signal.

TRADING STRATEGY:
{strategy}

CURRENT INDICATORS:
{indicators}

Respond with a JSON object:
{{
  "signal": "BUY" | "SELL" | "HOLD",
  "confidence": float between 0.0 and 1.0,
  "reasoning": "one sentence explaining the signal based on the current indicators"
}}"""


def _download_strategy(storage_path: str) -> dict:
    client = get_supabase()
    response = client.storage.from_(BUCKET).download(storage_path)
    return json.loads(response)


def predict_asset(symbol: str) -> AssetPrediction:
    session = get_session()
    try:
        asset = assets_repository.get_asset_by_symbol(session, symbol)
        if asset is None:
            raise ValueError(f"Asset with symbol {symbol} not found")

        active_model = asset_models_repository.get_active_model(session, asset.id)
        if active_model is None:
            raise ValueError(f"No trained model found for {symbol}. Run /train first.")

        metrics = active_model.metrics
        storage_path = active_model.storage_path
    finally:
        session.close()

    logger.info(f"Downloading strategy for {symbol}")
    strategy = _download_strategy(storage_path)

    ticker = yf.Ticker(get_yfinance_symbol(symbol))
    df = ticker.history(period="60d")
    df = _build_features(df)

    if df.empty:
        raise ValueError(f"Not enough data to build features for {symbol}")

    latest = df.iloc[-1]
    indicators = (
        f"RSI: {latest['rsi']:.2f} | "
        f"MACD: {latest['macd']:.4f} | "
        f"MACD Signal: {latest['macd_signal']:.4f} | "
        f"SMA7: {latest['sma_7']:.2f} | "
        f"SMA20: {latest['sma_20']:.2f} | "
        f"Price change: {latest['price_change']:.3%} | "
        f"Volume change: {latest['volume_change']:.3%}"
    )

    client = Groq(api_key=GROQ_API_KEY, timeout=30.0)
    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": _PREDICT_PROMPT.format(
                symbol=symbol,
                strategy=strategy.get("strategy", ""),
                indicators=indicators,
            )},
        ],
        temperature=0.1,
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content
    if raw is None:
        raise ValueError("Empty response from Groq")
    data = json.loads(raw)

    return AssetPrediction(
        symbol=symbol,
        signal=data["signal"],
        confidence=round(float(data["confidence"]), 4),
        metrics=metrics,
    )
