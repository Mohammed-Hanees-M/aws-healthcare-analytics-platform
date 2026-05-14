# 🏥 AWS-Powered Healthcare Data Analytics Platform

A production-grade, cloud-native healthcare analytics platform built on AWS, featuring real-time patient monitoring, ML-powered anomaly detection, and HIPAA-aligned security practices.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     React.js Frontend                    │
│              (CloudFront + S3 Static Hosting)            │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTPS
┌───────────────────────▼─────────────────────────────────┐
│                   API Gateway                            │
│              (REST API + JWT Auth)                       │
└──────┬────────────────┬──────────────────────┬──────────┘
       │                │                      │
┌──────▼──────┐  ┌──────▼──────┐  ┌───────────▼─────────┐
│  Node.js    │  │   Lambda    │  │   Lambda            │
│  EC2 API    │  │  ETL Pipeline│  │  Anomaly Detector   │
└──────┬──────┘  └──────┬──────┘  └───────────┬─────────┘
       │                │                      │
┌──────▼────────────────▼──────────────────────▼─────────┐
│              RDS PostgreSQL (Multi-AZ)                  │
└─────────────────────────────────────────────────────────┘
       │                │
┌──────▼──────┐  ┌──────▼──────┐
│  S3 Bucket  │  │ CloudWatch  │
│(Data/Backup)│  │ (Monitoring)│
└─────────────┘  └─────────────┘
```

## 🚀 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React.js 18, Recharts, TailwindCSS, React Query |
| Backend API | Node.js, Express.js, JWT Auth |
| Database | PostgreSQL (AWS RDS) |
| Serverless | AWS Lambda (Python) |
| ML Engine | Python, Scikit-learn, Pandas |
| Infrastructure | AWS EC2, S3, API Gateway, IAM, CloudWatch |
| Deployment | AWS Elastic Beanstalk, Docker |

---

## 📁 Project Structure

```
healthcare-analytics/
├── frontend/               # React.js dashboard
├── backend/                # Node.js Express API (EC2)
├── lambda/                 # AWS Lambda functions
│   ├── etl-pipeline/       # Data ingestion & transformation
│   ├── anomaly-detector/   # ML anomaly detection
│   └── data-ingestion/     # Kaggle dataset loader
├── ml/                     # ML models & notebooks
├── infrastructure/         # Terraform & CloudFormation
├── scripts/                # Setup & deployment scripts
└── docs/                   # Architecture diagrams
```

---

## ⚙️ Local Development Setup (Step-by-Step)

### Prerequisites

```bash
node --version    # v18+
python --version  # 3.10+
psql --version    # PostgreSQL 14+
```

Install if missing:
- Node.js: https://nodejs.org/
- Python: https://python.org/
- PostgreSQL: https://postgresql.org/

---

### Step 1 — Clone & Install Dependencies

```bash
# Clone or extract the project
cd healthcare-analytics

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

# Install ML/Lambda dependencies
cd ../lambda/etl-pipeline
pip install -r requirements.txt

cd ../anomaly-detector
pip install -r requirements.txt

cd ../../ml
pip install -r requirements.txt
```

---

### Step 2 — Setup PostgreSQL Database

```bash
# Start PostgreSQL service
# macOS:
brew services start postgresql
# Ubuntu/Linux:
sudo systemctl start postgresql
# Windows: Start from Services or pgAdmin

# Create database and user
psql -U postgres

# Inside psql shell, run:
CREATE DATABASE healthcare_db;
CREATE USER postgres WITH PASSWORD 'Hanees@2001';
GRANT ALL PRIVILEGES ON DATABASE healthcare_db TO postgres;
\q

# Run migrations
cd backend
npm run db:migrate

# Seed with Kaggle sample data
npm run db:seed
```

---

### Step 3 — Environment Variables

```bash
# Backend — copy and edit
cp backend/.env.example backend/.env

# Frontend — copy and edit
cp frontend/.env.example frontend/.env
```

Edit `backend/.env`:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=healthcare_db
DB_USER=postgres
DB_PASSWORD=Hanees@2001
JWT_SECRET=your_super_secret_jwt_key_here_change_in_production
PORT=5000
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
S3_BUCKET_NAME=healthcare-data-bucket
```

Edit `frontend/.env`:
```
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_ENV=development
```

---

### Step 4 — Load Kaggle Dataset

```bash
# Install Kaggle CLI
pip install kaggle

# Place your kaggle.json API token at ~/.kaggle/kaggle.json
# Download from: https://www.kaggle.com/settings → API → Create New Token

# Run the data loader script
cd scripts
python load_kaggle_data.py

# This downloads: Heart Disease + Diabetes 130 Hospitals datasets
# and loads them into PostgreSQL automatically
```

---

### Step 5 — Start the Application

```bash
# Terminal 1 — Start Backend API
cd backend
npm run dev
# → Running on http://localhost:5000

# Terminal 2 — Start Frontend
cd frontend
npm start
# → Running on http://localhost:3000

# Terminal 3 — Start ML Anomaly Service (optional for local)
cd lambda/anomaly-detector
python local_server.py
# → Running on http://localhost:8000
```

Open browser: **http://localhost:3000**

Login credentials (seeded):
- Admin: `admin@hospital.com` / `Admin@2025`
- Doctor: `doctor@hospital.com` / `Doctor@2025`

---

## ☁️ AWS Deployment Guide

### Step 1 — AWS CLI Setup

```bash
pip install awscli
aws configure
# Enter: Access Key ID, Secret Key, Region (us-east-1), Output (json)
```

### Step 2 — Infrastructure (Terraform)

```bash
cd infrastructure/terraform
terraform init
terraform plan
terraform apply
# Type: yes
# Takes ~10 minutes to provision all AWS resources
```

### Step 3 — Deploy Backend to EC2 / Elastic Beanstalk

```bash
cd backend
npm run build
eb init healthcare-backend --platform node.js --region us-east-1
eb create healthcare-production
eb deploy
```

### Step 4 — Deploy Lambda Functions

```bash
cd scripts
./deploy-lambdas.sh
```

### Step 5 — Deploy Frontend to S3 + CloudFront

```bash
cd frontend
npm run build
aws s3 sync build/ s3://your-bucket-name --delete
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

---

## 🔑 Key Features

- **Real-time Patient Dashboard** — Vitals, trends, admissions visualization
- **ML Anomaly Detection** — Flags abnormal vitals using Isolation Forest
- **ETL Pipeline** — Automated Kaggle dataset ingestion via Lambda
- **Role-Based Access** — Admin, Doctor, Nurse permissions via JWT + IAM
- **HIPAA-Aligned Security** — Encrypted at rest (S3/RDS), in transit (TLS)
- **CloudWatch Monitoring** — API latency, error rates, Lambda metrics

---

## 📊 Kaggle Datasets Used

1. **Heart Disease UCI** — `ronitf/heart-disease-uci`
2. **Diabetes 130 Hospitals** — `brandao/diabetes`
3. **Patient Vitals Monitoring** — `drscarlat/vitals`

---

## 🧪 Running Tests

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test

# ML model tests
cd ml
python -m pytest tests/
```
