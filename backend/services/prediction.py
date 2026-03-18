import logging
import numpy as np
import yfinance as yf
import onnxruntime as rt
from sqlmodel import Session
from backend.db import engine
from backend.supabase import get_supabase
from backend.repositories import assets as assets_repository
from backend.repositories import asset_models as asset_models_repository
from backend.train.features import FEATURES, build_features
from backend.types.prediction import AssetPrediction

logger = logging.getLogger(__name__)

BUCKET = "ml-models"


def _download_model(storage_path: str) -> rt.InferenceSession:
    client = get_supabase()
    onnx_bytes = client.storage.from_(BUCKET).download(storage_path)
    return rt.InferenceSession(onnx_bytes)


def predict_asset(symbol: str) -> AssetPrediction:
    with Session(engine) as session:
        asset = assets_repository.get_asset_by_symbol(session, symbol)
        if asset is None:
            raise ValueError(f"Asset with symbol {symbol} not found")

        active_model = asset_models_repository.get_active_model(session, asset.id)
        if active_model is None:
            raise ValueError(f"No trained model found for {symbol}. Run /train first.")

        metrics = active_model.metrics
        storage_path = active_model.storage_path

    logger.info(f"Downloading model for {symbol} from {storage_path}")
    sess = _download_model(storage_path)

    ticker = yf.Ticker(asset.yfinance_symbol)
    df = ticker.history(period="60d")
    df = build_features(df)

    if df.empty:
        raise ValueError(f"Not enough data to build features for {symbol}")

    input_name = sess.get_inputs()[0].name
    output_name = sess.get_outputs()[1].name
    X = df[FEATURES].iloc[[-1]].values.astype(np.float32)
    proba = sess.run([output_name], {input_name: X})[0][0]

    signal = "BUY" if proba[1] >= 0.5 else "SELL"
    confidence = round(float(max(proba)), 4)

    return AssetPrediction(
        symbol=symbol,
        signal=signal,
        confidence=confidence,
        metrics=metrics,
    )
