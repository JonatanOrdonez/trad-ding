from uuid import UUID
from sqlmodel import Session, select
from app.models.asset_model import AssetModel


def get_active_model(session: Session, asset_id: UUID) -> AssetModel | None:
    statement = (
        select(AssetModel)
        .where(AssetModel.asset_id == asset_id)
        .where(AssetModel.is_active == True)  # noqa: E712
    )
    return session.exec(statement).first()


def deactivate_models(session: Session, asset_id: UUID) -> None:
    statement = (
        select(AssetModel)
        .where(AssetModel.asset_id == asset_id)
        .where(AssetModel.is_active == True)  # noqa: E712
    )
    models = session.exec(statement).all()
    for model in models:
        model.is_active = False
        session.add(model)
    session.commit()


def get_all_models(session: Session, asset_id: UUID) -> list[AssetModel]:
    return list(session.exec(select(AssetModel).where(AssetModel.asset_id == asset_id)).all())


def delete_models_by_asset_id(session: Session, asset_id: UUID) -> None:
    models = session.exec(select(AssetModel).where(AssetModel.asset_id == asset_id)).all()
    for model in models:
        session.delete(model)
    session.commit()


def create_asset_model(
    session: Session,
    asset_id: UUID,
    storage_path: str,
    metrics: dict,
    features: dict,
) -> AssetModel:
    asset_model = AssetModel(
        asset_id=asset_id,
        storage_path=storage_path,
        metrics=metrics,
        features=features,
        is_active=True,
    )
    session.add(asset_model)
    session.commit()
    session.refresh(asset_model)
    return asset_model
