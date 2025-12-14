# ml/train_model.py
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score
import pickle
import os

# Generate synthetic training data (in production, use real logged data)
def generate_training_data(n_samples=1000):
    """
    Generate synthetic waiting time data based on common patterns
    """
    np.random.seed(42)
    
    data = []
    
    for _ in range(n_samples):
        stop_id = np.random.randint(1, 20)  # 20 different stops
        day_of_week = np.random.randint(0, 7)  # 0=Sunday, 6=Saturday
        hour_of_day = np.random.randint(5, 23)  # 5am to 11pm
        
        # Base waiting time
        base_wait = 10
        
        # Peak hours (7-9am, 4-7pm) have longer waits
        if (7 <= hour_of_day <= 9) or (16 <= hour_of_day <= 19):
            base_wait += np.random.randint(5, 15)
        
        # Weekends have slightly shorter waits
        if day_of_week in [0, 6]:  # Sunday or Saturday
            base_wait -= np.random.randint(0, 5)
        
        # Add some randomness
        waiting_time = max(2, base_wait + np.random.normal(0, 3))
        
        # Passenger count affects waiting time
        passenger_count = np.random.randint(1, 30)
        if passenger_count > 20:
            waiting_time += np.random.randint(2, 5)
        
        data.append({
            'stop_id': stop_id,
            'day_of_week': day_of_week,
            'hour_of_day': hour_of_day,
            'passenger_count': passenger_count,
            'waiting_time_minutes': waiting_time
        })
    
    return pd.DataFrame(data)

def train_model():
    """
    Train Random Forest model to predict waiting times
    """
    print("Generating training data...")
    df = generate_training_data(n_samples=2000)
    
    # Features and target
    X = df[['stop_id', 'day_of_week', 'hour_of_day', 'passenger_count']]
    y = df['waiting_time_minutes']
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    
    print(f"Training on {len(X_train)} samples...")
    
    # Train model
    model = RandomForestRegressor(
        n_estimators=100,
        max_depth=10,
        random_state=42,
        n_jobs=-1
    )
    
    model.fit(X_train, y_train)
    
    # Evaluate
    y_pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)
    
    print(f"\nModel Performance:")
    print(f"Mean Absolute Error: {mae:.2f} minutes")
    print(f"R² Score: {r2:.3f}")
    
    # Save model
    model_path = os.path.join(os.path.dirname(__file__), 'model.pkl')
    with open(model_path, 'wb') as f:
        pickle.dump(model, f)
    
    print(f"\nModel saved to: {model_path}")
    
    return model

if __name__ == '__main__':
    train_model()