from dataclasses import dataclass


@dataclass
class AssetAnalysis:
    symbol: str
    sentiment: str
    score: float
    score_interpretation: str
    summary: str
    growth_signals: list[str]
    risks: list[str]
    competitors_mentioned: list[str]
    monitor: list[str]
    action: str
    recommendation: str
