from dataclasses import dataclass
from uuid import UUID
from backend.models.asset_news import SourceType


@dataclass
class AssetNewsResult:
    id: UUID
    summary: str
    source_type: SourceType
    content: dict
