from dataclasses import dataclass


@dataclass
class AssetPrediction:
    symbol: str
    signal: str
    confidence: float
    metrics: dict
