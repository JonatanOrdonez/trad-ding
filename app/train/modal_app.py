import modal

app = modal.App("trad-ding-training")

image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install(
        "xgboost",
        "scikit-learn",
        "pandas",
        "yfinance",
        "supabase",
        "numpy",
    )
    .add_local_file("app/train/features.py", "/root/features.py")
)

BUCKET = "ml-models"


@app.function(
    image=image,
    secrets=[modal.Secret.from_dotenv()],
    timeout=300,
)
def train(symbol: str, yfinance_symbol: str) -> dict:
    import os
    import sys
    from datetime import datetime, timezone

    import yfinance as yf
    from sklearn.metrics import roc_auc_score
    from sklearn.model_selection import train_test_split
    from supabase import create_client
    from xgboost import XGBClassifier

    sys.path.insert(0, "/root")
    from features import FEATURES, build_features, compute_balanced_accuracy

    ticker = yf.Ticker(yfinance_symbol)
    df = ticker.history(period="1y")
    df.dropna(inplace=True)
    df = build_features(df)

    if len(df) < 50:
        raise ValueError(f"Not enough data to train model for {symbol}")

    balanced_accuracy = compute_balanced_accuracy(df)

    X = df[FEATURES]
    y = df["label"]
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, shuffle=False
    )

    model = XGBClassifier(
        n_estimators=100, max_depth=4, learning_rate=0.1, eval_metric="logloss"
    )
    model.fit(X_train, y_train)

    y_proba = model.predict_proba(X_test)[:, 1]
    roc_auc = round(float(roc_auc_score(y_test, y_proba)), 4)

    model.save_model("/tmp/model.onnx")
    with open("/tmp/model.onnx", "rb") as f:
        onnx_bytes = f.read()

    supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
    storage_path = f"{symbol}/{timestamp}-model.onnx"
    supabase.storage.from_(BUCKET).upload(
        path=storage_path,
        file=onnx_bytes,
        file_options={"content-type": "application/octet-stream", "upsert": "true"},
    )

    metrics = {"balanced_accuracy": balanced_accuracy, "roc_auc": roc_auc}
    return {"metrics": metrics, "storage_path": storage_path}
