import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone, timedelta
import modal
import yfinance as yf
from app.db import get_session
from app.repositories import assets as assets_repository
from app.repositories import asset_models as asset_models_repository
from app.train.features import FEATURES

logger = logging.getLogger(__name__)


def train_asset(symbol: str) -> dict:
    session = get_session()
    try:
        asset = assets_repository.get_asset_by_symbol(session, symbol)
        if asset is None:
            raise ValueError(f"Asset with symbol {symbol} not found")

        existing_model = asset_models_repository.get_active_model(session, asset.id)
    finally:
        session.close()

    logger.info(f"Fetching historical data for {symbol}")
    df = yf.Ticker(asset.yfinance_symbol).history(period="1y")
    df.dropna(inplace=True)
    records = df.reset_index().to_dict(orient="records")

    logger.info(f"Dispatching training for {symbol} to Modal")
    train_fn = modal.Function.from_name("trad-ding-training", "train")
    result = train_fn.remote(symbol, records)

    session = get_session()
    try:
        roc_auc = result["metrics"]["roc_auc"]

        if existing_model is None:
            should_save = True
        else:
            existing_roc_auc = existing_model.metrics.get("roc_auc", 0)
            improved = roc_auc > existing_roc_auc
            stale = datetime.now(timezone.utc) - existing_model.trained_at.replace(tzinfo=timezone.utc) > timedelta(days=5)
            should_save = improved or stale

        if not should_save:
            return {"improved": False, "metrics": result.get("metrics", {})}

        asset_models_repository.deactivate_models(session, asset.id)
        asset_models_repository.create_asset_model(
            session,
            asset.id,
            result["storage_path"],
            result["metrics"],
            {"features": FEATURES, "period": "1y"},
        )

        logger.info(f"Model for {symbol} trained and registered. Metrics: {result['metrics']}")
        return {"improved": True, "metrics": result["metrics"]}
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
