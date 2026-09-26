# Did You Feel That? <br><small>A Crowdsourced Earthquake Checker</small>

## DYFT Team

- **Musawar Ahmad (1629548)** - Group Leader, IAM, Elastic Load Balancing, CloudWatch, Automation
- **Ernest Divina (1627071)** - Cognito and User management, Backend: Cognito Lambda, and Frontend: part user login/registration pages with Mohammad
- **Charles Gerard Serrato (1625871)** - Backend: Verifier Lambda, EventBridge, GeoNet API, part of Ingestion Lambda
- **Jed Thomson (1709677)** - Backend: Notifier Lambda, DynamoDB, SQS, SES, Backend Ingestion
- **Mohammad Emon (1640350)** - Frontend: Webapp UI/UX

## Overview

_Did You Feel That?_ is a cloud-based platform for real-time seismic reporting. The web app collects crowdsourced user reports of felt earthquakes across New Zealand.

Logged-in users can submit a report at any time by selecting the "I Felt That" button. If GeoNet has not yet confirmed an earthquake at the time of submission, the web app displays how many nearby users reported similar shaking. When the system identifies and verifies a matching earthquake, it sends a notification directly to the user.

Every 15 minutes, the system fetches confirmed seismic data from GeoNet, filtering for earthquakes with a Modified Mercalli Intensity (MMI) rating of 4 or higher. The platform automatically cross-references user submissions against this data. If a report is submitted within 30 minutes of a confirmed quake and falls within a 50 km radius of its epicentre, the system verifies the report and sends an email notification to the user.

## AWS Architecture

- **Amazon Application Load Balancer**: Distributes incoming application traffic across Amazon EC2 instances to maintain the app's availability and stability.

- **Amazon EC2**: Hosts the web application server; serves user interfaces and frontend traffic management.

- **Amazon API Gateway + Amazon Lambda (Ingestion)**: Processes user report submissions fron the frontend and writes new reports directly into the `DYFT-REPORTS` DynamoDB table

- **Amazon DynamoDB**: Partitioned into two tables: `DYFT-REPORTS` which stores user report items, and `DYFT-USERS` which stores user account information.

- **Amazon Lambda (Verifier)**: Queries GeoNet API every 15 minutes via `EventBridge`, scans `DYFT-REPORTS` for unverified reports, and updates matching report fields to `verified = true`, and queues email notifications to SQS.

- **Amazon EventBridge**: Triggers the `Verifier` Lambda on a 15-minute schedule to poll the GeoNet API for new earthquake data.

- **GeoNet API**: Acts as the external source of truth, providing real-time seismic feature data to the `Verifier` Lambda.

- **Amazon Lambda (Notifier)**: Triggered by the `DYFT-DidYouQueueThat` SQS queue, sends email notifications to users who have had their report verified by the `Verfier`.

- **Amazon SQS**: Buffers notification messages from the `Verifier` Lambda to the `Notifier` Lambda which sends them downstream to Amazon SES.

- **Amazon SES**: Delivers alerts via email to users if their reports are verified against GeoNet earthquake data.

- **Amazon Cognito**: Manages user sign-up, sign-in, and authentication flows for the web app.

- **Amazon CloudWatch**: Provides dashboards and alarms for operational monitoring.

## Deployment Instructions

Deploy from the repository with AWS CLI credentials for the target account.

### Prerequisites

- AWS CLI authenticated in the user's AWS account.
- Must use Bash.
- Must have `zip` installed.
- Permission to create and manage the AWS resources defined by the stack.
- Permission to create named IAM roles because the deployment uses `CAPABILITY_NAMED_IAM`.
- Deployment region is fixed to `us-east-1`.

### Optional Email Settings

These environment variables are optional:

- `OPERATIONS_ALERT_EMAIL`: Subscribes an email address to the SNS topic used by CloudWatch alarms. AWS sends an SNS subscription confirmation email, and the user must confirm it. You may receive an initial alarm notification for Unhealthy EC2 targets, however this is only because deployment takes a while and can exceed the alarm threshold period.
- `SES_SENDER_EMAIL`: Sets the sender address for DYFT earthquake/report verification notification emails. When provided, `deploy.sh` automatically initiates SES email identity verification, AWS sends a verification email to that address, and the script waits for the sender to become verified before continuing.

For testing DYFT notification emails, register the DYFT account with the same verified email address supplied as `SES_SENDER_EMAIL`. Using the same email for `OPERATIONS_ALERT_EMAIL` and `SES_SENDER_EMAIL` is the simplest testing setup, but both variables remain independently optional.

**NOTE:** Either verification link can go to the Spam folder.

## Deploy

From the repository root:

#### 1. AWS CLI Authentication

Verify that the AWS CLI is authenticated:

```bash
aws sts get-caller-identity
```

#### 2. **Make the script executable:**

```bash
chmod +x deploy.sh
```

#### 3. **Run the automated deployment:**

```bash
./deploy.sh
```

OR With optional email settings:

```bash
OPERATIONS_ALERT_EMAIL="your-email@example.com" \
SES_SENDER_EMAIL="your-email@example.com" \
./deploy.sh
```

When `SES_SENDER_EMAIL` is supplied, keep the inbox open and click the AWS SES verification link when it arrives. The deployment waits up to about 5 minutes for verification before continuing.

NOTE: CloudFront creation, updates, and deletion can take some time to complete.

#### 4. **Get Application URL**

`deploy.sh` prints the stack outputs and the frontend URL at the end. Copy  `Frontend URL` from the CLI and paste into a browser. The URL looks like this:

```text
https://dxxxxxxxxxxxx.cloudfront.net
```

To fetch the URL again:

```bash
aws cloudformation describe-stacks \
  --stack-name dyft-auto-compx527 \
  --region us-east-1 \
  --query "Stacks[0].Outputs" \
  --output table
```

At a high level, the script:

- discovers the AWS-managed CloudFront origin-facing prefix-list ID
- deploys the CloudFormation stack
- packages and uploads the four Lambda functions
- waits for the CloudFront distribution to become deployed
- prints the CloudFormation outputs and frontend URL


## Remove the automated deployment

Once done, delete the stack:

```bash
aws cloudformation delete-stack --stack-name dyft-auto-compx527 --region us-east-1

aws cloudformation wait stack-delete-complete --stack-name dyft-auto-compx527 --region us-east-1
```