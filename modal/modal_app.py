import modal

app = modal.App("trad-ding-training")

image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install(
        "xgboost",
        "scikit-learn",
        "onnxmltools",
        "optuna",
        "pandas",
        "supabase",
        "numpy",
        "fastapi[standard]",
    )
    .add_local_file("modal/features.py", "/root/features.py")
)

BUCKET = "ml-models"


@app.function(
    image=image,
    secrets=[modal.Secret.from_dotenv(path="modal/.env")],
    timeout=600,
)
@modal.web_endpoint(method="POST")
def train(item: dict) -> dict:
    import os
    import sys
    from datetime import datetime, timezone

    import numpy as np
    import optuna
    import pandas as pd
    from sklearn.metrics import roc_auc_score
    from supabase import create_client
    from xgboost import XGBClassifier

    # Validate shared secret
    api_key = item.get("api_key", "")
    expected_key = os.environ.get("TRAIN_API_KEY", "")
    if not expected_key or api_key != expected_key:
        return {"error": "Forbidden"}

    symbol = item["symbol"]
    records = item["records"]

    sys.path.insert(0, "/root")
    from features import FEATURES, LABEL_HORIZON, build_features, compute_balanced_accuracy

    df = pd.DataFrame(records)
    df = build_features(df)

    if len(df) < 50:
        raise ValueError(f"Not enough data to train model for {symbol}")

    balanced_accuracy = compute_balanced_accuracy(df)

    X = df[FEATURES].values
    y = df["label"].values

    # Handle class imbalance
    n_pos = int(y.sum())
    n_neg = len(y) - n_pos
    scale_pos = n_neg / n_pos if n_pos > 0 else 1.0

    # ── Purged TimeSeriesSplit ────────────────────────────────────────────────
    # Gap of LABEL_HORIZON days between train/test to avoid label leakage
    def purged_ts_split(n_samples, n_splits=5, gap=LABEL_HORIZON):
        fold_size = n_samples // (n_splits + 1)
        for i in range(1, n_splits + 1):
            train_end = fold_size * i
            test_start = train_end + gap
            test_end = min(test_start + fold_size, n_samples)
            if test_start >= n_samples or test_end - test_start < 10:
                continue
            yield list(range(train_end)), list(range(test_start, test_end))

    # ── Optuna objective ─────────────────────────────────────────────────────
    optuna.logging.set_verbosity(optuna.logging.WARNING)

    def objective(trial):
        params = {
            "n_estimators": trial.suggest_int("n_estimators", 100, 500),
            "max_depth": trial.suggest_int("max_depth", 3, 8),
            "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.3, log=True),
            "subsample": trial.suggest_float("subsample", 0.6, 1.0),
            "colsample_bytree": trial.suggest_float("colsample_bytree", 0.5, 1.0),
            "min_child_weight": trial.suggest_int("min_child_weight", 1, 10),
            "gamma": trial.suggest_float("gamma", 0, 5.0),
            "reg_alpha": trial.suggest_float("reg_alpha", 1e-8, 10.0, log=True),
            "reg_lambda": trial.suggest_float("reg_lambda", 1e-8, 10.0, log=True),
        }

        fold_scores = []
        for train_idx, test_idx in purged_ts_split(len(X)):
            X_train, X_test = X[train_idx], X[test_idx]
            y_train, y_test = y[train_idx], y[test_idx]

            if len(np.unique(y_test)) < 2:
                continue

            model = XGBClassifier(
                **params,
                scale_pos_weight=scale_pos,
                eval_metric="logloss",
                early_stopping_rounds=20,
            )
            model.fit(
                X_train, y_train,
                eval_set=[(X_test, y_test)],
                verbose=False,
            )

            y_proba = model.predict_proba(X_test)[:, 1]
            fold_scores.append(roc_auc_score(y_test, y_proba))

        return float(np.mean(fold_scores)) if fold_scores else 0.0

    # ── Run Optuna ───────────────────────────────────────────────────────────
    study = optuna.create_study(direction="maximize")
    study.optimize(objective, n_trials=50, timeout=180)

    best_params = study.best_params
    print(f"[modal] {symbol} — best params: {best_params}")
    print(f"[modal] {symbol} — best trial ROC AUC: {study.best_value:.4f}")

    # ── Train final model with best params on all data ───────────────────────
    # Use last fold as held-out test for final metric
    splits = list(purged_ts_split(len(X)))
    if not splits:
        raise ValueError(f"Not enough data for purged CV for {symbol}")

    final_train_idx, final_test_idx = splits[-1]
    # Expand training to include all data before the final test set
    expanded_train_idx = list(range(final_test_idx[0]))

    final_model = XGBClassifier(
        **best_params,
        scale_pos_weight=scale_pos,
        eval_metric="logloss",
        early_stopping_rounds=20,
    )
    final_model.fit(
        X[expanded_train_idx], y[expanded_train_idx],
        eval_set=[(X[final_test_idx], y[final_test_idx])],
        verbose=False,
    )

    y_proba_final = final_model.predict_proba(X[final_test_idx])[:, 1]
    roc_auc = round(float(roc_auc_score(y[final_test_idx], y_proba_final)), 4)
    print(f"[modal] {symbol} — final model ROC AUC: {roc_auc}")

    # ── Convert to ONNX ─────────────────────────────────────────────────────
    # Rename features for onnxmltools compatibility
    feature_map = {name: f"f{i}" for i, name in enumerate(FEATURES)}
    X_renamed = pd.DataFrame(X, columns=FEATURES).rename(columns=feature_map)

    # Retrain with renamed columns so model internals use f0, f1, ...
    export_model = XGBClassifier(**best_params, scale_pos_weight=scale_pos, eval_metric="logloss")
    export_model.fit(X_renamed.values, y)

    from onnxmltools import convert_xgboost
    from onnxmltools.convert.common.data_types import FloatTensorType

    initial_type = [("features", FloatTensorType([None, len(FEATURES)]))]
    onnx_model = convert_xgboost(export_model, initial_types=initial_type)
    onnx_bytes = onnx_model.SerializeToString()

    supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
    storage_path = f"{symbol}/{timestamp}-model.onnx"
    supabase.storage.from_(BUCKET).upload(
        path=storage_path,
        file=onnx_bytes,
        file_options={"content-type": "application/octet-stream", "upsert": "true"},
    )

    metrics = {
        "balanced_accuracy": balanced_accuracy,
        "roc_auc": roc_auc,
        "optuna_best_roc": round(study.best_value, 4),
        "best_params": best_params,
    }
    return {"metrics": metrics, "storage_path": storage_path}
