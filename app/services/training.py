import io
import logging
import pickle
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import pandas as pd
import yfinance as yf
from xgboost import XGBClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, roc_auc_score, f1_score
from app.config import get_yfinance_symbol
from app.db import get_session
from app.supabase import get_supabase
from app.repositories import assets as assets_repository
from app.repositories import asset_models as asset_models_repository

logger = logging.getLogger(__name__)

BUCKET = "ml-models"
FEATURES = [
    "sma_7",
    "sma_20",
    "rsi",
    "macd",
    "macd_signal",
    "volume_change",
    "price_change",
]


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


def _train_model(df: pd.DataFrame) -> tuple[XGBClassifier, dict]:
    X = df[FEATURES]
    y = df["label"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, shuffle=False
    )

    model = XGBClassifier(
        n_estimators=100, max_depth=4, learning_rate=0.1, eval_metric="logloss"
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]

    metrics = {
        "accuracy": round(float(accuracy_score(y_test, y_pred)), 4),
        "roc_auc": round(float(roc_auc_score(y_test, y_prob)), 4),
        "f1_score": round(float(f1_score(y_test, y_pred)), 4),
    }

    return model, metrics


def _upload_model(model: XGBClassifier, symbol: str) -> str:
    client = get_supabase()
    buffer = io.BytesIO()
    pickle.dump(model, buffer)
    buffer.seek(0)

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
    path = f"{symbol}/{timestamp}-model.pkl"
    client.storage.from_(BUCKET).upload(
        path=path,
        file=buffer.read(),
        file_options={"content-type": "application/octet-stream", "upsert": "true"},
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

        logger.info(f"Training model for {symbol}")
        model, metrics = _train_model(df)

        active_model = asset_models_repository.get_active_model(session, asset.id)
        if active_model is not None:
            current_roc_auc = active_model.metrics.get("roc_auc", 0)
            if metrics["roc_auc"] <= current_roc_auc:
                logger.info(
                    f"New model roc_auc ({metrics['roc_auc']}) is not better than "
                    f"current ({current_roc_auc}). Discarding."
                )
                return {"improved": False, "metrics": metrics}

        logger.info(f"Uploading model for {symbol} to Supabase Storage")
        storage_path = _upload_model(model, symbol)

        asset_models_repository.deactivate_models(session, asset.id)
        asset_models_repository.create_asset_model(
            session,
            asset.id,
            storage_path,
            metrics,
            {"features": FEATURES, "period": "1y"},
        )

        logger.info(f"Model for {symbol} trained and activated. Metrics: {metrics}")
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
