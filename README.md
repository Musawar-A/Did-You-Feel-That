# Did You Feel That? <br><small>A Crowdsourced Earthquake Checker</small>

## DYFT Team

- **Musawar Ahmad (1629548)** - Group Leader and IAM Role and Policies management
- **Ernest Divina (1627071)** - Cognito and User management, Backend: Cognito Lambda, and Frontend: part user login/registration pages with Mohammad
- **Charles Gerard Serrato (1625871)** - Backend: Verifier Lambda, EventBridge, GeoNet API
- **Jed Thomson (1709677)** - Backend: Notifier Lambda, DynamoDB, SQS, SES, Backend Ingestion
- **Mohammad Emon (1640350)** - Frontend: Webapp UI/UX

## Overview

_Did You Feel That?_ is a cloud-based platform for real-time seismic reporting. The web app collects crowdsourced user reports of felt earthquakes across New Zealand.

Logged-in users can submit a report at any time by selecting the "I Felt That" button. If GeoNet has not yet confirmed an earthquake at the time of submission, the web app displays how many nearby users reported similar shaking. When the system identifies and verifies a matching earthquake, it sends a notification directly to the user.

Every 15 minutes, the system fetches confirmed seismic data from GeoNet, filtering for earthquakes with a Modified Mercalli Intensity (MMI) rating of 4 or higher. The platform automatically cross-references user submissions against this data. If a report is submitted within 30 minutes of a confirmed quake and falls within a 50 km radius of its epicentre, the system verifies the report and sends an email notification to the user.

## AWS Architecture

\<insert architecture image here\>

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

## Deployment Instructions

### Prerequisites \& Dependencies

- **Runtimes**: Python 3.12, Node.js 18+

- **AWS Resources**: AWS CLI configured with appropriate IAM permissions

- **Python Libraries**: `boto3`, `urllib3`

### Environment Variables

- `DB_TABLE_NAME`: The name of the REPORTS Dynamo DB table. Default is `DYFT-REPORTS`.
- `LOOKBACK_MINUTES`: Lookback window for fetching quakes and scanning reports. Default is `60`.
- `USE_MOCK_DATA`: Debug toggle. Forces Lambda to use local test data instead of live GeoNet API. Default is `false`.

---

### DynamoDB Schema

The system uses two separate DynamoDB tables to manage user profiles and user reports:

#### `REPORTS` Table

Stores all crowdsourced earthquake report submissions using a Global Secondary Index (GSI) pattern for queries.

- **Primary Key:**
  - **Partition Key (`PK`):** User identifier (e.g., `USER#user_test_001`).
  - **Sort Key (`SK`):** Unique report identifier (e.g., `REPORT#01KXYZ`).

- **Global Secondary Index (`GSI1`):**
  - **Index Partition Key (`GSI1PK`):** Set to `"REPORT"` for all report items (enables batch scanning across all unverified reports).
  - **Index Sort Key (`GSI1SK`):** ISO-8601 UTC creation timestamp (e.g., `2026-09-17T01:02:39.000Z`).

- **Attributes:**
  - `entity_type` (String): Fixed to `"REPORT"`.
  - `latitude` (Number): Geographic latitude of the report location (e.g., `-37.787`).
  - `longitude` (Number): Geographic longitude of the report location (e.g., `175.304`).
  - `timestamp` (String): ISO-8601 UTC timestamp of submission.
  - `verified` (Boolean): Verification flag (`true` or `false`).
  - `notification` (String): Dispatch status for alerting (`"unsent"`, `"sent"`, or `"error"`).
  - `mmi_value` (Number / Null): MMI intensity score added upon verification.
  - `publicID` (String / Null): GeoNet event identifier linked upon verification.
  - `verified_at` (String / Null): ISO-8601 UTC timestamp set when verified.

---

#### `USERS` Table

Stores user profile information and contact details for notifications.

- **Partition Key (`PK`):** Unique user identifier (e.g., `user_test_001`).
- **Key Attributes:**
  - `email` (String): User email address for receiving verification alerts.
  - `name` (String): User display name.
  - `created_at` (String): ISO-8601 UTC timestamp of account creation.
