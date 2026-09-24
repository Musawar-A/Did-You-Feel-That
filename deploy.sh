#!/bin/bash

set -euo pipefail

STACK_NAME="dyft-auto-compx527"
PREFIX="DYFT-AUTO"
REGION="us-east-1"
TEMPLATE="infrastructure/cloudformation/dyft.yml"

echo "======================================"
echo "Deploying DYFT infrastructure"
echo "======================================"

aws cloudformation deploy \
  --template-file "$TEMPLATE" \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    DeploymentPrefix="$PREFIX" \
    VpcId=vpc-098a72daab3d0a9a5 \
    PublicSubnet1=subnet-09e6d5e54c339cc5a \
    PublicSubnet2=subnet-0b357c2493cdf5f9c \
    WebServerAmiId=ami-084f35aa8cd582ea7 \
    CertificateArn=arn:aws:iam::987653905868:server-certificate/DYFT-LetsEncrypt-TLS \
    OperationsAlertEmail=musawarahmad05@gmail.com

echo "======================================"
echo "Packaging Lambda functions"
echo "======================================"

rm -rf .deployment
mkdir -p .deployment

zip -j .deployment/ingestion.zip \
  lambdas/ingestion/ingestion.py

zip -j .deployment/notifier.zip \
  lambdas/notifier/notifier.py

zip -j .deployment/users.zip \
  lambdas/user/users.py

zip -j .deployment/verifier.zip \
  lambdas/verifier/verifier.py


echo "======================================"
echo "Uploading Lambda code"
echo "======================================"

aws lambda update-function-code \
  --function-name "${PREFIX}-Ingestion" \
  --zip-file fileb://.deployment/ingestion.zip \
  --region "$REGION"

aws lambda wait function-updated \
  --function-name "${PREFIX}-Ingestion" \
  --region "$REGION"

aws lambda update-function-configuration \
  --function-name "${PREFIX}-Ingestion" \
  --handler ingestion.lambda_handler \
  --region "$REGION"


aws lambda update-function-code \
  --function-name "${PREFIX}-Notifier"\
  --zip-file fileb://.deployment/notifier.zip \
  --region "$REGION"

aws lambda wait function-updated \
  --function-name "${PREFIX}-Notifier" \
  --region "$REGION"

aws lambda update-function-configuration \
  --function-name "${PREFIX}-Notifier" \
  --handler notifier.lambda_handler \
  --region "$REGION"


aws lambda update-function-code \
  --function-name "${PREFIX}-COGNITO"\
  --zip-file fileb://.deployment/users.zip \
  --region "$REGION"

aws lambda wait function-updated \
  --function-name "${PREFIX}-COGNITO" \
  --region "$REGION"

aws lambda update-function-configuration \
  --function-name "${PREFIX}-COGNITO" \
  --handler users.lambda_handler \
  --region "$REGION"


aws lambda update-function-code \
  --function-name "${PREFIX}-SeismicVerifier" \
  --zip-file fileb://.deployment/verifier.zip \
  --region "$REGION"

aws lambda wait function-updated \
  --function-name "${PREFIX}-SeismicVerifier" \
  --region "$REGION"

aws lambda update-function-configuration \
  --function-name "${PREFIX}-SeismicVerifier" \
  --handler verifier.lambda_handler \
  --region "$REGION"


echo "======================================"
echo "Deployment complete"
echo "======================================"

aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs" \
  --output table