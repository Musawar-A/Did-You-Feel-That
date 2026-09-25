#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'USAGE'
Deploy DYFT infrastructure and Lambda code.

Default:
  ./deploy.sh creates a portable CloudFront HTTPS frontend.

Optional:
  OPERATIONS_ALERT_EMAIL    Optional SNS email subscription for CloudWatch alarms.
  SES_SENDER_EMAIL          Optional SES-verified sender used by notification emails.

Example:
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
OPERATIONS_ALERT_EMAIL="${OPERATIONS_ALERT_EMAIL:-}"
SES_SENDER_EMAIL="${SES_SENDER_EMAIL:-}"
REPOSITORY_URL="https://github.com/Musawar-A/dyft-compx527.git"
REPOSITORY_BRANCH="main"

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
echo "CloudFront will provide the portable HTTPS frontend."
echo "======================================"

echo "Discovering AWS-managed CloudFront origin prefix list..."
CLOUDFRONT_ORIGIN_PREFIX_LIST_ID="$(
  aws ec2 describe-managed-prefix-lists \
    --region "$REGION" \
    --filters Name=prefix-list-name,Values=com.amazonaws.global.cloudfront.origin-facing \
    --query "PrefixLists[0].PrefixListId" \
    --output text
)"

if [[ -z "$CLOUDFRONT_ORIGIN_PREFIX_LIST_ID" || "$CLOUDFRONT_ORIGIN_PREFIX_LIST_ID" == "None" ]]; then
  echo "Error: AWS-managed CloudFront origin-facing prefix list could not be found in region $REGION." >&2
  exit 1
fi

echo "CloudFront origin prefix list: $CLOUDFRONT_ORIGIN_PREFIX_LIST_ID"

aws cloudformation deploy \
  --template-file "$TEMPLATE" \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    DeploymentPrefix="$DEPLOYMENT_PREFIX" \
    CloudFrontOriginPrefixListId="$CLOUDFRONT_ORIGIN_PREFIX_LIST_ID" \
    OperationsAlertEmail="$OPERATIONS_ALERT_EMAIL" \
    SesSenderEmail="$SES_SENDER_EMAIL" \
    RepositoryUrl="$REPOSITORY_URL" \
    RepositoryBranch="$REPOSITORY_BRANCH"

CLOUDFRONT_DISTRIBUTION_ID="$(
  aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue | [0]" \
    --output text
)"

FRONTEND_URL="$(
  aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='FrontendUrl'].OutputValue | [0]" \
    --output text
)"

if [[ -z "$CLOUDFRONT_DISTRIBUTION_ID" || "$CLOUDFRONT_DISTRIBUTION_ID" == "None" ]]; then
  echo "Error: CloudFormation output CloudFrontDistributionId was not found." >&2
  exit 1
fi

if [[ -z "$FRONTEND_URL" || "$FRONTEND_URL" == "None" ]]; then
  echo "Error: CloudFormation output FrontendUrl was not found." >&2
  exit 1
fi

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
echo "Waiting for CloudFront distribution to be fully deployed..."
echo "======================================"

aws cloudfront wait distribution-deployed \
  --id "$CLOUDFRONT_DISTRIBUTION_ID" \
  --region "$REGION"

echo "======================================"
echo "Deployment complete"
echo "======================================"
echo
echo "Frontend URL:"
echo "$FRONTEND_URL"
echo
echo "Open this URL in your browser."
echo

aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs" \
  --output table
