#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'USAGE'
Deploy DYFT infrastructure and Lambda code.

Optional:
  CERTIFICATE_ARN           ACM or IAM TLS certificate ARN. Enables HTTPS when supplied.
  FRONTEND_ORIGIN           Allowed browser origin for CORS. Defaults to the ALB origin.
  OPERATIONS_ALERT_EMAIL    Optional SNS email subscription for CloudWatch alarms.
  SES_SENDER_EMAIL          Optional SES-verified sender used by notification emails.

Example:
  ./deploy.sh

HTTPS example:
  CERTIFICATE_ARN="arn:aws:acm:us-east-1:123456789012:certificate/example" \
  FRONTEND_ORIGIN="https://example.com" \
  OPERATIONS_ALERT_EMAIL="alerts@example.com" \
  SES_SENDER_EMAIL="alerts@example.com" \
  ./deploy.sh
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

STACK_NAME="dyft-auto-compx527"
DEPLOYMENT_PREFIX="DYFT-AUTO"
REGION="us-east-1"
TEMPLATE="${TEMPLATE:-infrastructure/cloudformation/dyft.yml}"
CERTIFICATE_ARN="${CERTIFICATE_ARN:-}"
FRONTEND_ORIGIN="${FRONTEND_ORIGIN:-}"
OPERATIONS_ALERT_EMAIL="${OPERATIONS_ALERT_EMAIL:-}"
SES_SENDER_EMAIL="${SES_SENDER_EMAIL:-}"
REPOSITORY_URL="https://github.com/Musawar-A/dyft-compx527.git"
REPOSITORY_BRANCH="automation"

if ! command -v aws >/dev/null 2>&1; then
  echo "Error: aws CLI is not installed or not on PATH." >&2
  exit 1
fi

if ! command -v zip >/dev/null 2>&1; then
  echo "Error: zip is not installed or not on PATH." >&2
  exit 1
fi

echo "======================================"
echo "Deploying DYFT infrastructure"
echo "Stack:  $STACK_NAME"
echo "Region: $REGION"
if [[ -n "$CERTIFICATE_ARN" ]]; then
  echo "TLS certificate supplied: HTTPS deployment enabled."
else
  echo "No TLS certificate supplied: deploying HTTP-only frontend."
fi
echo "======================================"

aws cloudformation deploy \
  --template-file "$TEMPLATE" \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    DeploymentPrefix="$DEPLOYMENT_PREFIX" \
    CertificateArn="$CERTIFICATE_ARN" \
    FrontendOrigin="$FRONTEND_ORIGIN" \
    OperationsAlertEmail="$OPERATIONS_ALERT_EMAIL" \
    SesSenderEmail="$SES_SENDER_EMAIL" \
    RepositoryUrl="$REPOSITORY_URL" \
    RepositoryBranch="$REPOSITORY_BRANCH"

echo "======================================"
echo "Packaging Lambda functions"
echo "======================================"

rm -rf .deployment
mkdir -p .deployment

zip -j .deployment/ingestion.zip lambdas/ingestion/ingestion.py
zip -j .deployment/notifier.zip lambdas/notifier/notifier.py
zip -j .deployment/users.zip lambdas/user/users.py
zip -j .deployment/verifier.zip lambdas/verifier/verifier.py

update_lambda() {
  local function_name="$1"
  local zip_file="$2"
  local handler="$3"

  aws lambda update-function-code \
    --function-name "$function_name" \
    --zip-file "fileb://$zip_file" \
    --region "$REGION"

  aws lambda wait function-updated \
    --function-name "$function_name" \
    --region "$REGION"

  aws lambda update-function-configuration \
    --function-name "$function_name" \
    --handler "$handler" \
    --region "$REGION"

  aws lambda wait function-updated \
    --function-name "$function_name" \
    --region "$REGION"
}

echo "======================================"
echo "Uploading Lambda code"
echo "======================================"

update_lambda "${DEPLOYMENT_PREFIX}-Ingestion" ".deployment/ingestion.zip" "ingestion.lambda_handler"
update_lambda "${DEPLOYMENT_PREFIX}-Notifier" ".deployment/notifier.zip" "notifier.lambda_handler"
update_lambda "${DEPLOYMENT_PREFIX}-COGNITO" ".deployment/users.zip" "users.lambda_handler"
update_lambda "${DEPLOYMENT_PREFIX}-SeismicVerifier" ".deployment/verifier.zip" "verifier.lambda_handler"

echo "======================================"
echo "Deployment complete"
echo "======================================"

aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs" \
  --output table
