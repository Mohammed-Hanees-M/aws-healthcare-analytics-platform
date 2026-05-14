"""
AWS Lambda Function: Kaggle Data Ingestion
Downloads datasets from Kaggle API → uploads to S3 → triggers ETL pipeline
"""

import json
import os
import boto3
import subprocess
import tempfile
import logging
from datetime import datetime

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3_client = boto3.client('s3', region_name=os.environ.get('AWS_REGION', 'us-east-1'))
lambda_client = boto3.client('lambda', region_name=os.environ.get('AWS_REGION', 'us-east-1'))

DATASETS = [
    {'name': 'ronitf/heart-disease-uci', 'files': ['heart.csv']},
    {'name': 'brandao/diabetes', 'files': ['diabetic_data.csv']},
]


def setup_kaggle_credentials():
    """Write Kaggle credentials from environment variables."""
    kaggle_dir = '/tmp/.kaggle'
    os.makedirs(kaggle_dir, exist_ok=True)
    creds = {
        'username': os.environ.get('KAGGLE_USERNAME', ''),
        'key': os.environ.get('KAGGLE_KEY', '')
    }
    with open(f'{kaggle_dir}/kaggle.json', 'w') as f:
        json.dump(creds, f)
    os.chmod(f'{kaggle_dir}/kaggle.json', 0o600)
    os.environ['KAGGLE_CONFIG_DIR'] = kaggle_dir


def download_dataset(dataset_name: str, dest_dir: str) -> list:
    """Download a Kaggle dataset to local /tmp directory."""
    result = subprocess.run(
        ['python', '-m', 'kaggle', 'datasets', 'download',
         '-d', dataset_name, '-p', dest_dir, '--unzip'],
        capture_output=True, text=True, timeout=120
    )
    if result.returncode != 0:
        logger.error(f"Kaggle download failed: {result.stderr}")
        raise RuntimeError(f"Failed to download {dataset_name}: {result.stderr}")
    logger.info(f"Downloaded {dataset_name}: {result.stdout}")
    return [f for f in os.listdir(dest_dir) if f.endswith('.csv')]


def upload_to_s3(local_path: str, bucket: str, s3_key: str) -> str:
    """Upload file to S3 with AES-256 encryption (HIPAA)."""
    s3_client.upload_file(
        local_path, bucket, s3_key,
        ExtraArgs={'ServerSideEncryption': 'AES256'}
    )
    logger.info(f"Uploaded to s3://{bucket}/{s3_key}")
    return s3_key


def trigger_etl_lambda(bucket: str, key: str):
    """Trigger the ETL pipeline Lambda with the new S3 object."""
    event = {
        'Records': [{
            's3': {
                'bucket': {'name': bucket},
                'object': {'key': key}
            }
        }]
    }
    lambda_client.invoke(
        FunctionName=os.environ.get('ETL_LAMBDA_ARN', 'healthcare-etl-pipeline'),
        InvocationType='Event',  # async
        Payload=json.dumps(event)
    )
    logger.info(f"Triggered ETL Lambda for {key}")


def lambda_handler(event, context):
    """Main handler — downloads Kaggle data and kicks off ETL."""
    bucket = os.environ.get('S3_BUCKET_NAME', 'healthcare-data-bucket')
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

    results = {'downloaded': [], 'uploaded': [], 'errors': []}

    try:
        setup_kaggle_credentials()
    except Exception as e:
        logger.error(f"Kaggle setup error: {e}")
        return {'statusCode': 500, 'body': json.dumps({'error': str(e)})}

    for dataset in DATASETS:
        with tempfile.TemporaryDirectory() as tmpdir:
            try:
                logger.info(f"Downloading {dataset['name']}...")
                files = download_dataset(dataset['name'], tmpdir)
                results['downloaded'].extend(files)

                for filename in files:
                    local_path = os.path.join(tmpdir, filename)
                    s3_key = f"datasets/raw/{timestamp}/{filename}"
                    upload_to_s3(local_path, bucket, s3_key)
                    results['uploaded'].append(s3_key)
                    trigger_etl_lambda(bucket, s3_key)

            except Exception as e:
                logger.error(f"Error processing {dataset['name']}: {e}")
                results['errors'].append({'dataset': dataset['name'], 'error': str(e)})

    return {
        'statusCode': 200,
        'body': json.dumps({
            'status': 'complete',
            'timestamp': timestamp,
            **results
        })
    }
