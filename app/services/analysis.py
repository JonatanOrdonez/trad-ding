import json
import logging
from concurrent.futures import ThreadPoolExecutor
from groq import Groq
from app.db import get_session
from app.env import GROQ_API_KEY
from app.repositories import assets as assets_repository
from app.services.news import get_news_by_asset
from app.services.prediction import predict_asset
from app.services.training import train_asset
from app.types.analysis import AssetAnalysis

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """You are an expert financial analyst combining two independent signals to produce \
actionable investment analysis:

1. FUNDAMENTAL / SENTIMENT signal — derived from recent news articles about the asset and the \
broader market. This reflects narratives, macro trends, earnings, and public perception.

2. TECHNICAL signal — produced by a trained XGBoost model using short-term price indicators \
(SMA-7, SMA-20, RSI-14, MACD, volume change). It predicts whether the next closing price will \
be higher or lower. Its quality is measured by ROC AUC (0.5 = random, 1.0 = perfect).

Your job is to weigh both signals together and produce a clear, honest recommendation. When the \
signals agree, conviction should be higher. When they conflict, explain why and lean toward the \
stronger or more reliable one. Write for someone with no investment background — be plain, direct, \
and avoid jargon.

You must respond exclusively with a valid JSON object. Do not include any text outside the JSON."""

_USER_PROMPT_TEMPLATE = """Analyze the following information for {symbol}.

--- GENERAL MARKET NEWS ---
{general_news}

--- NEWS SPECIFIC TO {symbol} ---
{asset_news}

--- TECHNICAL ML SIGNAL ---
Model prediction (next closing price direction): {model_signal}
Confidence: {model_confidence:.0%}
Model quality — balanced accuracy: {model_balanced_accuracy}, ROC AUC: {model_roc_auc}
(ROC AUC above 0.6 is reliable; below 0.55 should be treated with caution.)

Respond with a JSON object with exactly these fields:
{{
  "sentiment": "bullish" | "bearish" | "neutral",
  "score": float between -1.0 and 1.0,
  "score_interpretation": "one sentence explaining what the score means for this asset right now",
  "summary": "2-3 paragraphs: what this asset is, what the news says, and what the technical model suggests",
  "growth_signals": ["specific positive indicators found in the news or technicals"],
  "risks": ["specific risks mentioned or implied for this asset"],
  "competitors_mentioned": ["competitors named in the news, empty list if none"],
  "monitor": ["key factors to watch in the coming days"],
  "action": "BUY" | "SELL" | "HOLD",
  "recommendation": "one paragraph combining both signals into a final recommendation, noting where they agree or conflict"
}}"""


def _safe_predict(symbol: str) -> dict | None:
    try:
        result = predict_asset(symbol)
    except ValueError:
        logger.info(f"No model found for {symbol}, triggering training before prediction")
        try:
            train_asset(symbol)
            result = predict_asset(symbol)
        except Exception as e:
            logger.error(f"Training or prediction failed for {symbol}: {e}")
            return None
    except Exception as e:
        logger.error(f"Prediction failed for {symbol}: {e}")
        return None

    return {
        "signal": result.signal,
        "confidence": result.confidence,
        "balanced_accuracy": result.metrics.get("balanced_accuracy", 0),
        "roc_auc": result.metrics.get("roc_auc", 0),
    }


def _score_to_interpretation(score: float) -> str:
    if score >= 0.6:
        return "Strong positive sentiment. News suggests favorable conditions for investment."
    elif score >= 0.2:
        return "Moderate positive sentiment. Some encouraging signals but cautious optimism advised."
    elif score >= -0.2:
        return "Neutral sentiment. News does not strongly favor either direction."
    elif score >= -0.6:
        return (
            "Moderate negative sentiment. News suggests some headwinds for this asset."
        )
    else:
        return "Strong negative sentiment. News indicates significant challenges ahead."


def analyze_asset(symbol: str) -> AssetAnalysis:
    session = get_session()
    try:
        asset = assets_repository.get_asset_by_symbol(session, symbol)
        if asset is None:
            raise ValueError(f"Asset with symbol {symbol} not found")
    finally:
        session.close()

    with ThreadPoolExecutor(max_workers=3) as executor:
        future_general = executor.submit(get_news_by_asset, None, 0, 5)
        future_asset = executor.submit(get_news_by_asset, symbol, 0, 5)
        future_prediction = executor.submit(_safe_predict, symbol)
        general_news = future_general.result()
        asset_news = future_asset.result()
        ml_prediction = future_prediction.result()

    general_news_text = (
        "\n---\n".join(item.summary for item in general_news)
        or "No general news available."
    )
    asset_news_text = (
        "\n---\n".join(item.summary for item in asset_news)
        or "No specific news available for this asset."
    )

    client = Groq(api_key=GROQ_API_KEY, timeout=30.0)
    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {
                "role": "user",
                "content": _USER_PROMPT_TEMPLATE.format(
                    symbol=symbol,
                    general_news=general_news_text,
                    asset_news=asset_news_text,
                    model_signal=ml_prediction["signal"] if ml_prediction else "N/A",
                    model_confidence=ml_prediction["confidence"] if ml_prediction else 0,
                    model_balanced_accuracy=ml_prediction["balanced_accuracy"] if ml_prediction else "N/A",
                    model_roc_auc=ml_prediction["roc_auc"] if ml_prediction else "N/A",
                ),
            },
        ],
        temperature=0.3,
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content
    if raw is None:
        raise ValueError("Empty response from Groq")
    data = json.loads(raw)

    score = float(data["score"])

    return AssetAnalysis(
        symbol=symbol,
        sentiment=data["sentiment"],
        score=score,
        score_interpretation=_score_to_interpretation(score),
        summary=data["summary"],
        growth_signals=data.get("growth_signals", []),
        risks=data.get("risks", []),
        competitors_mentioned=data.get("competitors_mentioned", []),
        monitor=data.get("monitor", []),
        action=data.get("action", "HOLD"),
        recommendation=data.get("recommendation", ""),
    )
