#!/bin/bash
# deploy-lambdas.sh — Package and deploy all Lambda functions to AWS

set -e

REGION=${AWS_REGION:-us-east-1}
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
BUCKET=${S3_BUCKET_NAME:-healthcare-data-bucket}

echo "🚀 Deploying Lambda Functions"
echo "   Region:  $REGION"
echo "   Account: $ACCOUNT_ID"
echo "   Bucket:  $BUCKET"
echo ""

deploy_lambda() {
  FUNCTION_NAME=$1
  HANDLER=$2
  DIR=$3

  echo "📦 Packaging $FUNCTION_NAME..."
  cd "$DIR"

  # Install dependencies into package dir
  mkdir -p package
  pip install -r requirements.txt -t package/ --quiet

  # Copy handler
  cp handler.py package/

  # Zip it up
  cd package
  zip -r "../${FUNCTION_NAME}.zip" . -q
  cd ..

  # Deploy or create Lambda
  if aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" &>/dev/null; then
    echo "   Updating existing function..."
    aws lambda update-function-code \
      --function-name "$FUNCTION_NAME" \
      --zip-file "fileb://${FUNCTION_NAME}.zip" \
      --region "$REGION" \
      --output text --query 'FunctionArn'
  else
    echo "   Creating new function..."
    aws lambda create-function \
      --function-name "$FUNCTION_NAME" \
      --runtime python3.11 \
      --role "arn:aws:iam::${ACCOUNT_ID}:role/healthcare-lambda-role" \
      --handler "handler.lambda_handler" \
      --zip-file "fileb://${FUNCTION_NAME}.zip" \
      --timeout 300 \
      --memory-size 512 \
      --environment "Variables={
        DB_HOST=${DB_HOST},
        DB_NAME=${DB_NAME},
        DB_USER=${DB_USER},
        DB_PASSWORD=${DB_PASSWORD},
        S3_BUCKET_NAME=${S3_BUCKET_NAME},
        AWS_REGION=${REGION}
      }" \
      --region "$REGION" \
      --output text --query 'FunctionArn'
  fi

  echo "   ✅ $FUNCTION_NAME deployed"
  cd - > /dev/null
}

# Deploy all functions
deploy_lambda "healthcare-etl-pipeline" "handler.lambda_handler" "../lambda/etl-pipeline"
deploy_lambda "healthcare-anomaly-detector" "handler.lambda_handler" "../lambda/anomaly-detector"
deploy_lambda "healthcare-data-ingestion" "handler.lambda_handler" "../lambda/data-ingestion"

echo ""
echo "✅ All Lambda functions deployed!"
echo ""
echo "Setting up S3 trigger for ETL pipeline..."
aws s3api put-bucket-notification-configuration \
  --bucket "$BUCKET" \
  --notification-configuration '{
    "LambdaFunctionConfigurations": [{
      "LambdaFunctionArn": "arn:aws:lambda:'$REGION':'$ACCOUNT_ID':function:healthcare-etl-pipeline",
      "Events": ["s3:ObjectCreated:*"],
      "Filter": {
        "Key": {
          "FilterRules": [{"Name": "prefix", "Value": "datasets/raw/"}]
        }
      }
    }]
  }' 2>/dev/null && echo "✅ S3 trigger configured" || echo "⚠️  S3 trigger setup skipped (manual setup may be needed)"
