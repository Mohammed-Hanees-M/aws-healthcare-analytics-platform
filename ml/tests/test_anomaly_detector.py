"""
ML Model Tests — pytest
Run: python -m pytest tests/ -v
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import numpy as np
import pytest

# ─── Isolation Forest Tests ────────────────────────────────────────────────────
class TestAnomalyDetector:

    def setup_method(self):
        """Generate synthetic vitals for testing."""
        np.random.seed(42)
        self.normal_vitals = {
            'heart_rate': 75.0,
            'systolic_bp': 120.0,
            'diastolic_bp': 80.0,
            'oxygen_saturation': 98.0,
            'temperature': 36.8,
            'respiratory_rate': 16.0,
            'glucose_level': 100.0
        }
        self.critical_vitals = {
            'heart_rate': 165.0,
            'systolic_bp': 195.0,
            'diastolic_bp': 118.0,
            'oxygen_saturation': 84.0,
            'temperature': 40.2,
            'respiratory_rate': 34.0,
            'glucose_level': 420.0
        }

    def test_rule_based_normal_vitals(self):
        """Normal vitals should not trigger rule-based anomaly."""
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../lambda/anomaly-detector'))
        from handler import rule_based_severity
        is_anomaly, severity, score, anomaly_type = rule_based_severity(self.normal_vitals)
        assert not is_anomaly, "Normal vitals incorrectly flagged as anomaly"
        assert score < 0.5

    def test_rule_based_critical_vitals(self):
        """Critical vitals must trigger anomaly detection."""
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../lambda/anomaly-detector'))
        from handler import rule_based_severity
        is_anomaly, severity, score, anomaly_type = rule_based_severity(self.critical_vitals)
        assert is_anomaly, "Critical vitals not flagged as anomaly"
        assert severity in ('high', 'critical')
        assert score >= 0.5

    def test_isolation_forest_training(self):
        """Isolation Forest trains and predicts correctly on synthetic data."""
        try:
            from sklearn.ensemble import IsolationForest
            from sklearn.preprocessing import StandardScaler
        except ImportError:
            pytest.skip("scikit-learn not installed")

        # Build synthetic training data
        np.random.seed(42)
        n = 500
        X_normal = np.column_stack([
            np.random.uniform(58, 100, n),   # heart_rate
            np.random.uniform(100, 140, n),  # systolic_bp
            np.random.uniform(60, 90, n),    # diastolic_bp
            np.random.uniform(94, 100, n),   # spo2
            np.random.uniform(36.0, 37.5, n),# temp
            np.random.uniform(12, 22, n),    # resp_rate
            np.random.uniform(70, 200, n),   # glucose
        ])
        X_anomaly = np.column_stack([
            np.random.uniform(140, 180, 50),
            np.random.uniform(170, 210, 50),
            np.random.uniform(110, 130, 50),
            np.random.uniform(82, 90, 50),
            np.random.uniform(39.5, 41.0, 50),
            np.random.uniform(30, 40, 50),
            np.random.uniform(350, 500, 50),
        ])
        X_train = np.vstack([X_normal, X_anomaly])

        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X_train)

        model = IsolationForest(n_estimators=100, contamination=0.08, random_state=42)
        model.fit(X_scaled)

        # Test normal prediction
        normal_sample = scaler.transform(X_normal[:5])
        preds = model.predict(normal_sample)
        normal_correct = sum(p == 1 for p in preds)
        assert normal_correct >= 3, f"Too many false positives: {5 - normal_correct}/5 normal flagged"

        # Test anomaly prediction
        anomaly_sample = scaler.transform(X_anomaly[:5])
        preds = model.predict(anomaly_sample)
        anomaly_detected = sum(p == -1 for p in preds)
        assert anomaly_detected >= 3, f"Too many false negatives: only {anomaly_detected}/5 anomalies detected"

    def test_model_score_range(self):
        """Anomaly scores should be clipped between 0 and 1."""
        try:
            from sklearn.ensemble import IsolationForest
            from sklearn.preprocessing import StandardScaler
        except ImportError:
            pytest.skip("scikit-learn not installed")

        X = np.random.rand(200, 7)
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
        model = IsolationForest(n_estimators=50, random_state=42)
        model.fit(X_scaled)

        scores = -model.score_samples(X_scaled)
        clipped = np.clip(scores, 0, 1)
        assert all(0 <= s <= 1 for s in clipped), "Scores out of [0,1] range"

    def test_missing_vitals_handled(self):
        """Missing vital values should not crash the detector."""
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../lambda/anomaly-detector'))
        from handler import rule_based_severity
        partial_vitals = {'heart_rate': 75.0, 'oxygen_saturation': None, 'systolic_bp': None}
        # Should not raise an exception
        result = rule_based_severity(partial_vitals)
        assert len(result) == 4


# ─── ETL Transformation Tests ─────────────────────────────────────────────────
class TestETLTransformations:

    def test_detect_heart_disease_dataset(self):
        """Column detection should identify Heart Disease UCI dataset."""
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../lambda/etl-pipeline'))
        import pandas as pd
        from handler import detect_dataset_type
        df = pd.DataFrame(columns=['age', 'sex', 'cp', 'trestbps', 'chol', 'thalach', 'target'])
        assert detect_dataset_type(df) == 'heart_disease'

    def test_detect_diabetes_dataset(self):
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../lambda/etl-pipeline'))
        import pandas as pd
        from handler import detect_dataset_type
        df = pd.DataFrame(columns=['race', 'gender', 'age', 'hba1c_level', 'readmitted'])
        assert detect_dataset_type(df) == 'diabetes'

    def test_sample_patient_generation(self):
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../lambda/etl-pipeline'))
        from handler import generate_sample_patients
        patients = generate_sample_patients(10)
        assert len(patients) == 10
        for p in patients:
            assert p['patient_id'].startswith('SMP')
            assert p['age'] >= 25
            assert p['ward'] in ['ICU', 'Cardiology', 'General', 'Emergency', 'Oncology']


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
