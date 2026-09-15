"""
AcademicAI — Multi-Model Training Script
========================================
Trains 5 classifiers on the UCI Student Performance dataset and saves
all artifacts to backend/models/. Also writes model_metadata.json used
by the API.

Models:
  1. RandomForestClassifier  (primary)
  2. LogisticRegression
  3. KNeighborsClassifier
  4. GradientBoostingClassifier
  5. MLPClassifier (Neural Network)

Run:  python train_models.py
"""

import os
import json
import joblib
import numpy as np
import pandas as pd
from datetime import datetime

from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.neighbors import KNeighborsClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score

BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR  = os.path.join(BASE_DIR, "models")
DATA_PATH   = os.path.join(BASE_DIR, "..", "data", "student-mat.csv")

NUMERIC_COLS = [
    'age', 'Medu', 'Fedu', 'traveltime', 'studytime', 'failures',
    'famrel', 'freetime', 'goout', 'Dalc', 'Walc', 'health', 'absences', 'G1', 'G2',
]

CATEGORICAL_COLS = [
    'sex', 'address', 'famsize', 'Pstatus', 'Mjob', 'Fjob', 'reason', 'guardian',
    'schoolsup', 'famsup', 'paid', 'activities', 'nursery', 'higher', 'internet', 'romantic',
]

FEATURES = [
    'sex', 'age', 'address', 'famsize', 'Pstatus', 'Medu', 'Fedu',
    'Mjob', 'Fjob', 'reason', 'guardian', 'traveltime', 'studytime',
    'failures', 'schoolsup', 'famsup', 'paid', 'activities', 'nursery',
    'higher', 'internet', 'romantic', 'famrel', 'freetime', 'goout',
    'Dalc', 'Walc', 'health', 'absences', 'G1', 'G2',
]


def target_label(g3):
    if g3 == 0:
        return 'At-Risk'
    if g3 < 10:
        return 'Fail'
    return 'Pass'


def build_datasets():
    """Load, feature-engineer, and encode the raw dataset."""
    df = pd.read_csv(DATA_PATH, sep=';')
    df['target'] = df['G3'].apply(target_label)

    X = df[FEATURES].copy()
    y = df['target']

    label_encoders = {}
    for col in CATEGORICAL_COLS:
        le = LabelEncoder()
        X[col] = le.fit_transform(X[col].astype(str))
        label_encoders[col] = le

    target_encoder = LabelEncoder()
    y_encoded = target_encoder.fit_transform(y)

    categorical_mappings = {}
    for col, le in label_encoders.items():
        categorical_mappings[col] = {
            str(cls): int(idx) for idx, cls in enumerate(le.classes_)
        }

    return X, y_encoded, FEATURES, label_encoders, target_encoder, categorical_mappings, df, y


def evaluate(pipe_X, y, model, scaler_name="standard"):
    """Train/val split + 5-fold stratified CV scoring."""
    X_train, X_test, y_train, y_test = train_test_split(
        pipe_X, y, test_size=0.2, random_state=42, stratify=y
    )
    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s = scaler.transform(X_test)

    model.fit(X_train_s, y_train)
    pred = model.predict(X_test_s)

    cv = StratifiedKFold(5, shuffle=True, random_state=42)
    cv_scores = cross_val_score(model, scaler.transform(pipe_X), y, cv=cv)

    return {
        "accuracy":       float(accuracy_score(y_test, pred)),
        "cv_accuracy":    float(cv_scores.mean()),
        "cv_std":         float(cv_scores.std()),
        "precision":      float(precision_score(y_test, pred, average="weighted", zero_division=0)),
        "recall":         float(recall_score(y_test, pred, average="weighted", zero_division=0)),
        "f1":             float(f1_score(y_test, pred, average="weighted", zero_division=0)),
        "scaler":         scaler,
        "model":          model,
    }


def main():
    os.makedirs(MODELS_DIR, exist_ok=True)

    X, y, FEATURES, label_encoders, target_encoder, categorical_mappings, df_orig, y_series = build_datasets()
    class_dist = {k: int(v) for k, v in y_series.value_counts().items()}

    models = {
        "Random Forest":    RandomForestClassifier(n_estimators=200, max_depth=12, min_samples_split=4, class_weight='balanced', random_state=42, n_jobs=-1),
        "Logistic Regression": LogisticRegression(max_iter=2000, class_weight='balanced', random_state=42),
        "K-Nearest Neighbors": KNeighborsClassifier(n_neighbors=7, weights='distance'),
        "Gradient Boosting": GradientBoostingClassifier(n_estimators=150, max_depth=3, learning_rate=0.08, random_state=42),
        "Neural Network":    MLPClassifier(hidden_layer_sizes=(64, 32), max_iter=600, random_state=42, early_stopping=True),
    }

    performance = {}
    for name, model in models.items():
        res = evaluate(X, y, model)
        scaler = res.pop("scaler")
        fitted = res.pop("model")
        slug = name.lower().replace(" ", "_").replace("-", "_")
        joblib.dump(fitted, os.path.join(MODELS_DIR, f"{slug}.pkl"))
        joblib.dump(scaler, os.path.join(MODELS_DIR, f"{slug}_scaler.pkl"))
        performance[name] = {k: round(v, 4) for k, v in res.items()}
        print(f"{name:20s} acc={res['accuracy']*100:5.1f}%  cv={res['cv_accuracy']*100:5.1f}%  f1={res['f1']:.3f}")

    # ── Pick the best model as the primary (highest CV accuracy) ──────────────
    best_name = max(performance, key=lambda k: performance[k]["cv_accuracy"])
    best_slug = best_name.lower().replace(" ", "_").replace("-", "_")
    print(f"\nPrimary model selected: {best_name}")

    # ── Save shared encoders + primary artifacts ──────────────────────────────
    joblib.dump(joblib.load(os.path.join(MODELS_DIR, f"{best_slug}.pkl")),  os.path.join(BASE_DIR, "model.pkl"))
    joblib.dump(joblib.load(os.path.join(MODELS_DIR, f"{best_slug}_scaler.pkl")), os.path.join(BASE_DIR, "scaler.pkl"))
    joblib.dump(target_encoder, os.path.join(BASE_DIR, "target_encoder.pkl"))
    joblib.dump(label_encoders, os.path.join(BASE_DIR, "label_encoders.pkl"))

    feat_imp = sorted(
        zip(FEATURES, RandomForestClassifier(n_estimators=50, random_state=42).fit(
            StandardScaler().fit_transform(X), y
        ).feature_importances_),
        key=lambda x: x[1], reverse=True
    )

    metadata = {
        "model_type":      best_name,
        "accuracy":        performance[best_name]["accuracy"],
        "cv_accuracy":     performance[best_name]["cv_accuracy"],
        "cv_std":          performance[best_name]["cv_std"],
        "features":        FEATURES,
        "n_features":      len(FEATURES),
        "target_classes":  target_encoder.classes_.tolist(),
        "class_distribution": class_dist,
        "dataset":         "UCI Student Performance (Math)",
        "dataset_size":    int(len(df_orig)),
        "top_features":    [f for f, _ in feat_imp[:10]],
        "categorical_cols": CATEGORICAL_COLS,
        "categorical_mappings": {k: {str(kk): int(vv) for kk, vv in v.items()} for k, v in categorical_mappings.items()},
        "models":          performance,
        "primary_model":   best_name,
        "trained_at":      datetime.now().isoformat(),
    }

    with open(os.path.join(BASE_DIR, "model_metadata.json"), "w") as f:
        json.dump(metadata, f, indent=2)

    with open(os.path.join(MODELS_DIR, "performance.json"), "w") as f:
        json.dump(performance, f, indent=2)

    print("\nAll artifacts saved to backend/models/ and backend/model_metadata.json")


if __name__ == "__main__":
    main()