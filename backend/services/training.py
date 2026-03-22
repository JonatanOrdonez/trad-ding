import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone, timedelta

import modal
import yfinance as yf

from backend.supabase import get_supabase
from backend.train.features import FEATURES

logger = logging.getLogger(__name__)


def _get_all_assets() -> list[dict]:
    return get_supabase().from_("assets").select("id, symbol, yfinance_symbol").execute().data or []


def _get_active_model(asset_id: str) -> dict | None:
    return (
        get_supabase()
        .from_("asset_models")
        .select("id, metrics, created_at")
        .eq("asset_id", asset_id)
        .eq("is_active", True)
        .maybe_single()
        .execute()
        .data
    )


def _deactivate_models(asset_id: str) -> None:
    get_supabase().from_("asset_models").update({"is_active": False}).eq("asset_id", asset_id).execute()


def _save_model(asset_id: str, storage_path: str, metrics: dict) -> None:
    get_supabase().from_("asset_models").insert({
        "asset_id": asset_id,
        "storage_path": storage_path,
        "metrics": metrics,
        "is_active": True,
    }).execute()


def train_asset(symbol: str, asset_id: str, yfinance_symbol: str) -> dict:
    existing_model = _get_active_model(asset_id)

    logger.info(f"Fetching 1y historical data for {symbol}")
    df = yf.Ticker(yfinance_symbol).history(period="1y")
    df.dropna(inplace=True)
    records = df.reset_index().to_dict(orient="records")

    logger.info(f"Dispatching training for {symbol} to Modal")
    train_fn = modal.Function.from_name("trad-ding-training", "train")
    result = train_fn.remote(symbol, records)

    roc_auc = result["metrics"]["roc_auc"]

    if existing_model is None:
        should_save = True
    else:
        existing_roc_auc = (existing_model.get("metrics") or {}).get("roc_auc", 0)
        improved = roc_auc > existing_roc_auc
        created_at = datetime.fromisoformat(existing_model["created_at"].replace("Z", "+00:00"))
        stale = datetime.now(timezone.utc) - created_at > timedelta(days=5)
        should_save = improved or stale

    if not should_save:
        return {"improved": False, "metrics": result.get("metrics", {})}

    _deactivate_models(asset_id)
    _save_model(asset_id, result["storage_path"], result["metrics"])

    logger.info(f"Model for {symbol} saved. Metrics: {result['metrics']}")
    return {"improved": True, "metrics": result["metrics"]}


def _train_asset_safe(asset: dict) -> dict:
    symbol = asset["symbol"]
    try:
        return {"symbol": symbol, **train_asset(symbol, asset["id"], asset["yfinance_symbol"])}
    except Exception as e:
        logger.error(f"Training failed for {symbol}: {e}")
        return {"symbol": symbol, "improved": False, "error": str(e)}


def train_all_assets() -> list[dict]:
    assets = _get_all_assets()
    with ThreadPoolExecutor() as executor:
        futures = [executor.submit(_train_asset_safe, asset) for asset in assets]
        return [f.result() for f in as_completed(futures)]
