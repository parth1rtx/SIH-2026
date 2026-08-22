from flask import Flask, request, jsonify
import pickle
import pandas as pd

app = Flask(__name__)

from xgboost import XGBClassifier

model = XGBClassifier()
model.load_model("xgb_model.json")

FEATURE_COLUMNS = [
    'avg_metered', 'std_metered', 'max_metered',
    'min_metered', 'avg_actual', 'theft_ratio', 'zero_day_ratio'
]

@app.route("/", methods=["GET"])
def home():
    return jsonify({"status": "DayInBits API is running"})

@app.route("/predict", methods=["POST"])
def predict():
    data = request.json
    df = pd.DataFrame([data])
    df = df[FEATURE_COLUMNS]  # ensure correct column order
    prediction = model.predict(df)[0]
    probability = model.predict_proba(df)[0][1]
    return jsonify({
        "is_katiya": int(prediction),
        "theft_probability": round(float(probability), 3)
    })

if __name__ == "__main__":
    app.run(debug=True, port=5000)