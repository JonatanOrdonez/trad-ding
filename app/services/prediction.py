import io
import logging
import pickle
import pandas as pd
import yfinance as yf
from xgboost import XGBClassifier
from app.config import get_yfinance_symbol
from app.db import get_session
from app.supabase import get_supabase
from app.repositories import assets as assets_repository
from app.repositories import asset_models as asset_models_repository
from app.services.training import BUCKET, FEATURES, _build_features
from app.types.prediction import AssetPrediction

logger = logging.getLogger(__name__)


def _download_model(storage_path: str) -> XGBClassifier:
    client = get_supabase()
    response = client.storage.from_(BUCKET).download(storage_path)
    return pickle.loads(response)


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

    logger.info(f"Downloading model for {symbol} from {storage_path}")
    model = _download_model(storage_path)

    ticker = yf.Ticker(get_yfinance_symbol(symbol))
    df = ticker.history(period="60d")
    df = _build_features(df)

    if df.empty:
        raise ValueError(f"Not enough data to build features for {symbol}")

    latest = df[FEATURES].iloc[[-1]]
    proba = model.predict_proba(latest)[0]
    signal = "BUY" if proba[1] >= 0.5 else "SELL"
    confidence = round(float(max(proba)), 4)

    return AssetPrediction(
        symbol=symbol,
        signal=signal,
        confidence=confidence,
        metrics=metrics,
    )
