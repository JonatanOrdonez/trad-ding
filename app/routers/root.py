from fastapi import APIRouter

router = APIRouter()


@router.get("/")
@router.get("/health")
def root():
    return {"status": "OK"}
