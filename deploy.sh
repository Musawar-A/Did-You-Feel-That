#!/usr/bin/env bash

set -euo pipefail

# Prevent AWS CLI output from opening an interactive pager.
export AWS_PAGER=""

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
DEPLOYMENT_DIR=".deployment"
FRONTEND_ARTIFACT_ZIP="$DEPLOYMENT_DIR/frontend-source.zip"
ARTIFACT_KEY="frontend-source.zip"
ARTIFACT_BUCKET=""
ARTIFACT_BUCKET_CREATED="false"

cleanup_artifact_bucket() {
  local cleanup_status=$?

  if [[ "$ARTIFACT_BUCKET_CREATED" == "true" && -n "$ARTIFACT_BUCKET" ]]; then
    set +e
    aws s3 rm "s3://$ARTIFACT_BUCKET/$ARTIFACT_KEY" --region "$REGION" >/dev/null 2>&1
    local object_cleanup_status=$?
    aws s3 rb "s3://$ARTIFACT_BUCKET" --region "$REGION" >/dev/null 2>&1
    local bucket_cleanup_status=$?
    set -e

    if [[ $object_cleanup_status -ne 0 || $bucket_cleanup_status -ne 0 ]]; then
      echo "Warning: temporary S3 artifact cleanup did not complete. Bucket: $ARTIFACT_BUCKET" >&2
    fi
  fi

  return "$cleanup_status"
}

trap cleanup_artifact_bucket EXIT

verify_ses_sender_email() {
  if [[ -z "$SES_SENDER_EMAIL" ]]; then
    return 0
  fi

  local verified_status
  local get_identity_status
  local elapsed=0
  local poll_interval=5
  local max_wait=300

  echo "Checking SES sender email identity: $SES_SENDER_EMAIL"

  set +e
  verified_status="$(
    aws sesv2 get-email-identity \
      --email-identity "$SES_SENDER_EMAIL" \
      --region "$REGION" \
      --query "VerifiedForSendingStatus" \
      --output text 2>/dev/null
  )"
  get_identity_status=$?
  set -e

  if [[ $get_identity_status -eq 0 ]]; then
    if [[ "$verified_status" == "True" || "$verified_status" == "true" ]]; then
      echo "SES sender email is already verified."
      return 0
    fi

    echo "SES sender email identity exists but is not verified yet."
    echo "Check $SES_SENDER_EMAIL and click the AWS SES verification link."
  else
    aws sesv2 create-email-identity \
      --email-identity "$SES_SENDER_EMAIL" \
      --region "$REGION" >/dev/null

    echo "AWS has sent an SES verification email to $SES_SENDER_EMAIL."
    echo "Open that inbox and click the AWS SES verification link."
  fi

  echo "Waiting for SES sender email verification..."

  while (( elapsed <= max_wait )); do
    set +e
    verified_status="$(
      aws sesv2 get-email-identity \
        --email-identity "$SES_SENDER_EMAIL" \
        --region "$REGION" \
        --query "VerifiedForSendingStatus" \
        --output text 2>/dev/null
    )"
    get_identity_status=$?
    set -e

    if [[ $get_identity_status -eq 0 ]]; then
      if [[ "$verified_status" == "True" || "$verified_status" == "true" ]]; then
        echo "SES sender email is verified."
        return 0
      fi
    fi

    if (( elapsed == max_wait )); then
      break
    fi

    sleep "$poll_interval"
    elapsed=$((elapsed + poll_interval))
  done

  echo "Error: SES sender email was not verified within 5 minutes. Verify $SES_SENDER_EMAIL and run the deployment again." >&2
  exit 1
}

if ! command -v aws >/dev/null 2>&1; then
  echo "Error: aws CLI is not installed or not on PATH." >&2
  exit 1
fi

if ! command -v zip >/dev/null 2>&1; then
  echo "Error: zip is not installed or not on PATH." >&2
  exit 1
fi

if [[ ! -f "$TEMPLATE" ]]; then
  echo "Error: CloudFormation template not found: $TEMPLATE" >&2
  exit 1
fi

if [[ ! -d frontend ]]; then
  echo "Error: frontend directory not found." >&2
  exit 1
fi

if [[ ! -f frontend/package.json || ! -f frontend/package-lock.json ]]; then
  echo "Error: frontend/package.json and frontend/package-lock.json are required for EC2 npm ci." >&2
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

verify_ses_sender_email

rm -rf "$DEPLOYMENT_DIR"
mkdir -p "$DEPLOYMENT_DIR"
zip -qr "$FRONTEND_ARTIFACT_ZIP" frontend \
  -x "frontend/node_modules/*" \
  -x "frontend/dist/*" \
  -x "frontend/.env" \
  -x "frontend/.env.local" \
  -x "frontend/.env.*.local"

AWS_ACCOUNT_ID="$(
  aws sts get-caller-identity \
    --region "$REGION" \
    --query Account \
    --output text
)"

if [[ -z "$AWS_ACCOUNT_ID" || "$AWS_ACCOUNT_ID" == "None" ]]; then
  echo "Error: AWS account ID could not be determined." >&2
  exit 1
fi

ARTIFACT_BUCKET="dyft-auto-frontend-${AWS_ACCOUNT_ID}-$(date -u +%Y%m%d%H%M%S)-${RANDOM}${RANDOM}"
ARTIFACT_BUCKET="$(echo "$ARTIFACT_BUCKET" | tr '[:upper:]' '[:lower:]')"

aws s3api create-bucket \
  --bucket "$ARTIFACT_BUCKET" \
  --region "$REGION" >/dev/null
ARTIFACT_BUCKET_CREATED="true"

aws s3api put-public-access-block \
  --bucket "$ARTIFACT_BUCKET" \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true \
  --region "$REGION"

aws s3 cp "$FRONTEND_ARTIFACT_ZIP" "s3://$ARTIFACT_BUCKET/$ARTIFACT_KEY" \
  --region "$REGION" >/dev/null

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
    FrontendArtifactBucket="$ARTIFACT_BUCKET" \
    FrontendArtifactKey="$ARTIFACT_KEY"

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

mkdir -p "$DEPLOYMENT_DIR"

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
