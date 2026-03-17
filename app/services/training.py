import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
import modal
from app.config import get_yfinance_symbol
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

        logger.info(f"Dispatching training for {symbol} to Modal")
        train_fn = modal.Function.from_name("trad-ding-training", "train")
        result = train_fn.remote(symbol, get_yfinance_symbol(symbol))

        balanced_accuracy = result["metrics"]["balanced_accuracy"]
        has_no_model = existing_model is None
        improved = balanced_accuracy > 0.5

        if not has_no_model and not improved:
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
