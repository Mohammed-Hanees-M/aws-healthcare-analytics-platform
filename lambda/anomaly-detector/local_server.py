"""
Local Flask server to simulate Lambda anomaly detector during development.
Run: python local_server.py
"""
from flask import Flask, request, jsonify
import os, sys
sys.path.insert(0, os.path.dirname(__file__))

app = Flask(__name__)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy', 'service': 'anomaly-detector-local'})

@app.route('/detect', methods=['POST'])
def detect():
    from handler import lambda_handler
    event = request.get_json() or {}
    result = lambda_handler(event, None)
    return jsonify(result)

@app.route('/detect/sample', methods=['POST'])
def detect_sample():
    """Run anomaly detection on last 24h of data."""
    from handler import lambda_handler
    result = lambda_handler({'hours_back': 24}, None)
    return jsonify(result)

if __name__ == '__main__':
    print("🔬 Anomaly Detector Local Server")
    print("   POST /detect      — run detection")
    print("   GET  /health      — health check")
    app.run(host='0.0.0.0', port=8000, debug=True)
