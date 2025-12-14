# ml/predictor_service.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import pickle
import numpy as np
import os

app = Flask(__name__)
CORS(app)

# Load trained model
model_path = os.path.join(os.path.dirname(__file__), 'model.pkl')

try:
    with open(model_path, 'rb') as f:
        model = pickle.load(f)
    print(f"✅ Model loaded from {model_path}")
except FileNotFoundError:
    print(f"⚠️  Model not found at {model_path}. Run train_model.py first!")
    model = None

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'model_loaded': model is not None
    })

@app.route('/predict', methods=['POST'])
def predict():
    """
    Predict waiting time
    
    Expected JSON body:
    {
        "stop_id": 1,
        "day_of_week": 1,  # 0=Sunday, 6=Saturday
        "hour_of_day": 14,  # 0-23
        "passenger_count": 15  # optional, defaults to 10
    }
    """
    try:
        if model is None:
            return jsonify({
                'error': 'Model not loaded. Train the model first.'
            }), 500
        
        data = request.json
        
        # Extract features
        stop_id = data.get('stop_id', 1)
        day_of_week = data.get('day_of_week', 1)
        hour_of_day = data.get('hour_of_day', 12)
        passenger_count = data.get('passenger_count', 10)
        
        # Create feature array
        features = np.array([[stop_id, day_of_week, hour_of_day, passenger_count]])
        
        # Predict
        prediction = model.predict(features)[0]
        
        # Round to nearest minute and ensure minimum of 2 minutes
        predicted_wait = max(2, round(prediction))
        
        return jsonify({
            'predicted_wait_minutes': int(predicted_wait),
            'stop_id': stop_id,
            'day_of_week': day_of_week,
            'hour_of_day': hour_of_day
        })
    
    except Exception as e:
        return jsonify({
            'error': str(e)
        }), 400

@app.route('/batch_predict', methods=['POST'])
def batch_predict():
    """
    Predict for multiple stops at once
    
    Expected JSON body:
    {
        "predictions": [
            {"stop_id": 1, "day_of_week": 1, "hour_of_day": 14},
            {"stop_id": 2, "day_of_week": 1, "hour_of_day": 14}
        ]
    }
    """
    try:
        if model is None:
            return jsonify({
                'error': 'Model not loaded'
            }), 500
        
        data = request.json
        predictions_input = data.get('predictions', [])
        
        results = []
        for item in predictions_input:
            stop_id = item.get('stop_id', 1)
            day_of_week = item.get('day_of_week', 1)
            hour_of_day = item.get('hour_of_day', 12)
            passenger_count = item.get('passenger_count', 10)
            
            features = np.array([[stop_id, day_of_week, hour_of_day, passenger_count]])
            prediction = model.predict(features)[0]
            
            results.append({
                'stop_id': stop_id,
                'predicted_wait_minutes': int(max(2, round(prediction)))
            })
        
        return jsonify({'predictions': results})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 400

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)