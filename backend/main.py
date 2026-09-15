"""
AcademicAI — Student Performance Prediction API
================================================
Author  : Mohammad Umar — B.Tech CSE
Dataset : UCI Student Performance (Math) — student-mat.csv
Models  : 5 sklearn classifiers → Random Forest selected as primary

Endpoints:
  GET    /                     → health check
  POST   /predict              → predict performance (primary model)
  POST   /predict-model/{name}  → predict with a specific model
  POST   /save-response        → save anonymous quiz response
  POST   /retrain              → retrain all models (requires API key)
  GET    /model-info           → model metadata and stats
  GET    /models               → all models' performance comparison
  GET    /stats                → collected response statistics
  POST   /register             → create account
  POST   /login                → login → bearer token
  POST   /logout               → invalidate token
  GET    /me                   → current user profile
  GET    /history              → user's past predictions
  POST   /chatbot              → rule-based academic assistant
  GET    /admin/stats          → admin analytics (requires ADMIN_KEY)
"""

import os
import csv
import json
from datetime import datetime
from typing import Any, Dict, List, Optional

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, BackgroundTasks, Query, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from db import (
    init_db, create_user, verify_login, create_session, user_by_token,
    delete_session, save_prediction, get_history, get_users_count,
    get_predictions_count, get_prediction_distribution,
)
from chatbot import respond as chatbot_respond

# ─── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR       = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR     = os.path.join(BASE_DIR, "models")
MODEL_PATH     = os.path.join(BASE_DIR, "model.pkl")
SCALER_PATH    = os.path.join(BASE_DIR, "scaler.pkl")
TARGET_ENC_PATH= os.path.join(BASE_DIR, "target_encoder.pkl")
LABEL_ENC_PATH = os.path.join(BASE_DIR, "label_encoders.pkl")
METADATA_PATH  = os.path.join(BASE_DIR, "model_metadata.json")
RESPONSES_PATH = os.path.join(BASE_DIR, "student_responses.csv")
ORIGINAL_DATA  = os.path.join(BASE_DIR, "..", "data", "student-mat.csv")

# ─── Config ───────────────────────────────────────────────────────────────────
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
    if o.strip()
]
RETRAIN_API_KEY = os.getenv("RETRAIN_API_KEY", "")
ADMIN_KEY       = os.getenv("ADMIN_KEY", "academicai-admin")

NUMERIC_COLS = [
    'age', 'Medu', 'Fedu', 'traveltime', 'studytime', 'failures',
    'famrel', 'freetime', 'goout', 'Dalc', 'Walc', 'health', 'absences', 'G1', 'G2',
]

# ─── Model registry ───────────────────────────────────────────────────────────
MODEL_REGISTRY = {}   # slug -> dict(model, scaler, label, primary, metrics)


def _slug(name: str) -> str:
    return name.lower().replace(" ", "_").replace("-", "_")


def _load_single_model_artifacts():
    """Load primary model + encoders + metadata."""
    global model, scaler, target_encoder, label_encoders, metadata, FEATURES, CATEGORICAL_COLS
    model           = joblib.load(MODEL_PATH)
    scaler          = joblib.load(SCALER_PATH)
    target_encoder  = joblib.load(TARGET_ENC_PATH)
    label_encoders  = joblib.load(LABEL_ENC_PATH)
    with open(METADATA_PATH) as f:
        metadata = json.load(f)
    FEATURES          = metadata["features"]
    CATEGORICAL_COLS  = metadata["categorical_cols"]
    return metadata.get("primary_model", "Random Forest")


def load_model_artifacts():
    global metadata
    primary_name = _load_single_model_artifacts()

    MODEL_REGISTRY.clear()
    primary_slug = _slug(primary_name)
    for name, perf in metadata.get("models", {}).items():
        slug = _slug(name)
        m_path = os.path.join(MODELS_DIR, f"{slug}.pkl")
        s_path = os.path.join(MODELS_DIR, f"{slug}_scaler.pkl")
        if not (os.path.isfile(m_path) and os.path.isfile(s_path)):
            print(f"[AcademicAI] Skipping '{name}': artifact missing")
            continue
        try:
            entry = joblib.load(m_path)
            scaler_entry = joblib.load(s_path)
            MODEL_REGISTRY[slug] = {
                "model":       entry,
                "scaler":      scaler_entry,
                "label":       name,
                "primary":     slug == primary_slug,
                "accuracy":    perf.get("accuracy"),
                "cv_accuracy": perf.get("cv_accuracy"),
                "f1":          perf.get("f1"),
            }
        except Exception as e:
            print(f"[AcademicAI] Skipping '{name}' (failed to load: {e})")
    print(f"[AcademicAI] Models loaded: {list(MODEL_REGISTRY.keys())}")
    print(f"[AcademicAI] Primary model: {primary_name}")


init_db()
load_model_artifacts()

# ─── FastAPI app ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="AcademicAI — Student Performance API",
    description="Predicts Pass/Fail/At-Risk, multi-model comparison, user accounts, progress tracking, and an academic assistant.",
    version="3.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Schemas ──────────────────────────────────────────────────────────────────

class StudentInput(BaseModel):
    sex:       str  = Field(..., description="M or F")
    age:       int  = Field(..., ge=15, le=35)
    address:   str  = Field(..., description="U=urban, R=rural")
    famsize:   str  = Field(..., description="GT3 or LE3")
    Pstatus:   str  = Field(..., description="T=together, A=apart")
    Medu:     int   = Field(..., ge=0, le=4)
    Fedu:     int   = Field(..., ge=0, le=4)
    Mjob:     str   = Field(..., description="at_home/health/other/services/teacher")
    Fjob:     str   = Field(..., description="at_home/health/other/services/teacher")
    reason:   str   = Field(..., description="course/home/other/reputation")
    guardian: str   = Field(..., description="mother/father/other")
    traveltime: int = Field(..., ge=1, le=4)
    studytime:  int = Field(..., ge=1, le=4)
    failures:   int = Field(..., ge=0, le=4)
    schoolsup:  str = Field(..., description="yes or no")
    famsup:     str = Field(..., description="yes or no")
    paid:       str = Field(..., description="yes or no")
    activities: str = Field(..., description="yes or no")
    nursery:    str = Field(..., description="yes or no")
    higher:     str = Field(..., description="yes or no")
    internet:   str = Field(..., description="yes or no")
    romantic:   str = Field(..., description="yes or no")
    famrel:   int = Field(..., ge=1, le=5)
    freetime: int = Field(..., ge=1, le=5)
    goout:    int = Field(..., ge=1, le=5)
    Dalc:     int = Field(..., ge=1, le=5)
    Walc:     int = Field(..., ge=1, le=5)
    health:   int = Field(..., ge=1, le=5)
    absences: int = Field(..., ge=0, le=100)
    G1:       int = Field(..., ge=0, le=20)
    G2:       int = Field(..., ge=0, le=20)


class SaveResponseRequest(BaseModel):
    features:          Dict[str, Any]
    prediction:        str
    confidence:        float
    confidence_scores: Dict[str, float]
    timestamp:         str


class RegisterRequest(BaseModel):
    name:     str = Field(..., min_length=2, max_length=60)
    email:    str = Field(..., max_length=120)
    password: str = Field(..., min_length=6, max_length=128)


class LoginRequest(BaseModel):
    email:    str
    password: str


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=500)


# ─── Auth dependency ──────────────────────────────────────────────────────────

def get_auth_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Authentication required.")
    token = authorization.split(" ", 1)[1].strip()
    user = user_by_token(token)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid or expired session.")
    return {**user, "token": token}


def _try_auth_user(authorization: Optional[str] = Header(None)):
    if authorization and authorization.lower().startswith("bearer "):
        return user_by_token(authorization.split(" ", 1)[1].strip())
    return None


# ─── Helper: encode one student input ─────────────────────────────────────────

def encode_input(data: StudentInput, scaler_obj=None) -> np.ndarray:
    scaler_obj = scaler_obj or scaler
    raw = {
        'sex': data.sex, 'age': data.age, 'address': data.address,
        'famsize': data.famsize, 'Pstatus': data.Pstatus,
        'Medu': data.Medu, 'Fedu': data.Fedu, 'Mjob': data.Mjob, 'Fjob': data.Fjob,
        'reason': data.reason, 'guardian': data.guardian,
        'traveltime': data.traveltime, 'studytime': data.studytime,
        'failures': data.failures, 'schoolsup': data.schoolsup,
        'famsup': data.famsup, 'paid': data.paid, 'activities': data.activities,
        'nursery': data.nursery, 'higher': data.higher,
        'internet': data.internet, 'romantic': data.romantic,
        'famrel': data.famrel, 'freetime': data.freetime, 'goout': data.goout,
        'Dalc': data.Dalc, 'Walc': data.Walc, 'health': data.health,
        'absences': data.absences, 'G1': data.G1, 'G2': data.G2,
    }
    df = pd.DataFrame([raw])
    for col in CATEGORICAL_COLS:
        if col in label_encoders:
            try:
                df[col] = label_encoders[col].transform(df[col])
            except ValueError:
                df[col] = 0
    df = df[FEATURES]
    return scaler_obj.transform(df)


def _build_result(pred_class, probabilities, model_used="Random Forest"):
    confidence_scores = {
        cls: round(float(prob) * 100, 1)
        for cls, prob in zip(target_encoder.classes_, probabilities)
    }
    if pred_class in target_encoder.classes_:
        idx = int(np.where(target_encoder.classes_ == pred_class)[0][0])
        confidence = round(float(probabilities[idx]) * 100, 1)
    else:
        confidence = round(float(np.max(probabilities)) * 100, 1)
    tips = {
        "Pass":    "You're on track. Keep attending classes, stay consistent with your study routine, and don't get complacent. Small drops in attendance or study time can change this quickly.",
        "Fail":    "Your profile shows warning signs, but this is fixable. Start by attending every class this week, increase your study time to at least 5 hours/week, and visit your professor to ask exactly what to focus on for exams.",
        "At-Risk": "This is urgent. You need to act now — attend every class, meet your academic advisor this week, and clear any pending backlogs immediately. Consider reaching out to your college counseling cell for support.",
    }
    emojis = {"Pass": "🎓", "Fail": "📉", "At-Risk": "⚠️"}
    return {
        "prediction":        pred_class,
        "emoji":             emojis.get(pred_class, "🎓"),
        "confidence":        confidence,
        "confidence_scores": confidence_scores,
        "tip":               tips.get(pred_class, ""),
        "model_used":        model_used,
        "model_accuracy":    f"{metadata['accuracy'] * 100:.1f}%",
        "cv_accuracy":       f"{metadata['cv_accuracy'] * 100:.1f}%",
        "dataset_size":      metadata["dataset_size"],
    }


# ─── Public endpoints ─────────────────────────────────────────────────────────

@app.get("/", summary="Health check")
def root():
    return {
        "status":         "✅ AcademicAI API is running!",
        "primary_model":  metadata.get("primary_model", "Random Forest"),
        "models":         list(MODEL_REGISTRY.keys()),
        "accuracy":       f"{metadata['accuracy'] * 100:.1f}%",
        "cv_accuracy":    f"{metadata['cv_accuracy'] * 100:.1f}%",
        "dataset_size":   metadata["dataset_size"],
        "docs":           "/docs"
    }


@app.post("/predict", summary="Predict using the best model")
def predict(data: StudentInput, authorization: Optional[str] = Header(None)):
    try:
        X_scaled = encode_input(data)
        pred_encoded  = model.predict(X_scaled)[0]
        probabilities = model.predict_proba(X_scaled)[0]
        pred_class    = target_encoder.inverse_transform([pred_encoded])[0]
        result = _build_result(pred_class, probabilities, metadata.get("primary_model", "Random Forest"))

        user = _try_auth_user(authorization)
        if user:
            save_prediction(
                user["id"], result["model_used"], pred_class,
                result["confidence"], result["confidence_scores"],
                features=data.model_dump(),
            )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@app.post("/predict-model/{name}", summary="Predict using a specific model")
def predict_model(name: str, data: StudentInput):
    slug = _slug(name)
    if slug not in MODEL_REGISTRY:
        raise HTTPException(status_code=404, detail=f"Unknown model. Available: {list(MODEL_REGISTRY.keys())}")
    entry = MODEL_REGISTRY[slug]
    try:
        X_scaled = encode_input(data, entry["scaler"])
        pred_encoded  = entry["model"].predict(X_scaled)[0]
        probabilities = entry["model"].predict_proba(X_scaled)[0]
        pred_class    = target_encoder.inverse_transform([pred_encoded])[0]
        return _build_result(pred_class, probabilities, entry["label"])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@app.get("/models", summary="All models' performance comparison")
def models_overview():
    return {
        "primary_model": metadata.get("primary_model"),
        "models": [
            {
                "slug": slug,
                "name": e["label"],
                "is_primary": e["primary"],
                "accuracy": e.get("accuracy"),
                "cv_accuracy": e.get("cv_accuracy"),
                "f1": e.get("f1"),
            }
            for slug, e in MODEL_REGISTRY.items()
        ],
    }


@app.post("/save-response", summary="Save anonymous quiz response")
def save_response(data: SaveResponseRequest):
    try:
        file_exists = os.path.isfile(RESPONSES_PATH)
        row = {
            "timestamp":  data.timestamp,
            "prediction": data.prediction,
            "confidence": data.confidence,
            **{f"prob_{k}": v for k, v in data.confidence_scores.items()},
        }
        for feat in FEATURES:
            row[feat] = data.features.get(feat, "")
        fieldnames = list(row.keys())
        with open(RESPONSES_PATH, "a", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
            if not file_exists:
                writer.writeheader()
            writer.writerow(row)
        return {"status": "saved"}
    except Exception as e:
        return {"status": "skipped", "reason": str(e)}


@app.get("/stats", summary="Collected responses statistics")
def get_stats():
    if not os.path.isfile(RESPONSES_PATH):
        return {"total_responses": 0, "message": "No responses collected yet"}
    try:
        df = pd.read_csv(RESPONSES_PATH)
        dist = df["prediction"].value_counts().to_dict() if "prediction" in df.columns else {}
        return {
            "total_responses": len(df),
            "prediction_distribution": dist,
            "latest_response": df["timestamp"].max() if "timestamp" in df.columns else None,
        }
    except Exception as e:
        return {"error": str(e)}


@app.get("/model-info", summary="Model metadata and performance stats")
def model_info():
    return {
        "primary_model":   metadata["model_type"],
        "accuracy":        f"{metadata['accuracy'] * 100:.1f}%",
        "cv_accuracy":     f"{metadata['cv_accuracy'] * 100:.1f}%",
        "cv_std":          f"{metadata.get('cv_std', 0) * 100:.1f}%",
        "n_features":      metadata["n_features"],
        "target_classes":  metadata["target_classes"],
        "dataset_size":    metadata["dataset_size"],
        "top_features":    metadata["top_features"],
        "last_retrained":  metadata.get("last_retrained", "original training"),
        "dataset":         metadata.get("dataset", "UCI Student Performance"),
    }


# ─── Auth endpoints ───────────────────────────────────────────────────────────

@app.post("/register", summary="Create account")
def register(req: RegisterRequest):
    ok, data = create_user(req.name, req.email, req.password)
    if not ok:
        raise HTTPException(status_code=400, detail=data)
    token = create_session(data["id"])
    return {"token": token, "user": data}


@app.post("/login", summary="Login")
def login(req: LoginRequest):
    user = verify_login(req.email, req.password)
    if user is None:
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    token = create_session(user["id"])
    return {
        "token": token,
        "user": {"id": user["id"], "name": user["name"], "email": user["email"]},
    }


@app.post("/logout", summary="Logout")
def logout(user: dict = Depends(get_auth_user)):
    delete_session(user["token"])
    return {"status": "logged_out"}


@app.get("/me", summary="Current user profile")
def me(user: dict = Depends(get_auth_user)):
    return {"user": {"id": user["id"], "name": user["name"], "email": user["email"]}}


@app.get("/history", summary="Logged-in user's past predictions")
def history(user: dict = Depends(get_auth_user)):
    return {"history": get_history(user["id"], limit=50)}


# ─── Chatbot ──────────────────────────────────────────────────────────────────

@app.post("/chatbot", summary="Academic Q&A assistant")
def chat(req: ChatRequest):
    return {"reply": chatbot_respond(req.message)}


# ─── Admin ────────────────────────────────────────────────────────────────────

@app.get("/admin/stats", summary="Admin analytics")
def admin_stats(api_key: str = Query(None)):
    if ADMIN_KEY and api_key != ADMIN_KEY:
        raise HTTPException(status_code=403, detail="Invalid admin key.")
    anon = get_stats()
    anon_count = anon.get("total_responses", 0) if isinstance(anon, dict) else 0
    return {
        "users":                     get_users_count(),
        "predictions":               get_predictions_count(),
        "prediction_distribution":   get_prediction_distribution(),
        "anon_responses":            anon_count,
        "models":                    list(MODEL_REGISTRY.keys()),
    }


# ─── Retraining ───────────────────────────────────────────────────────────────

@app.post("/retrain", summary="Retrain all models with collected responses")
def retrain(background_tasks: BackgroundTasks, api_key: str = Query(None)):
    if RETRAIN_API_KEY and api_key != RETRAIN_API_KEY:
        raise HTTPException(status_code=403, detail="Invalid or missing API key.")
    if not os.path.isfile(RESPONSES_PATH):
        raise HTTPException(status_code=400, detail="No collected responses yet. Use the app to gather data first.")
    background_tasks.add_task(_retrain_background)
    return {"status": "Retraining started in background. Check /model-info for updates."}


def _retrain_background():
    from train_models import main as retrain_all
    try:
        retrain_all()
        load_model_artifacts()
        print("[AcademicAI] Retraining complete — all models reloaded")
    except Exception as e:
        print(f"[AcademicAI] Retraining failed: {e}")