import json
import math
import os
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation

import boto3
from botocore.exceptions import ClientError

LAMBDA_NAME = "DYFT-Ingestion"
TABLE_NAME = os.getenv("REPORTS_TABLE_NAME", "DYFT-REPORTS")
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "https://didyoufeelthat.devs.surf")

# DynamoDB
dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(TABLE_NAME)

# Repeated CORS headers for responses
CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": FRONTEND_ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
}


def haversine_km(lat1, lon1, lat2, lon2):
    """
    Calculate distance between two points from the globe.
    """
    # Earth's radius in km
    R = 6371.0

    # Make sure they're Floats
    lat1, lon1, lat2, lon2 = (
        float(lat1),
        float(lon1),
        float(lat2),
        float(lon2),
    )

    # Get difference in coords (in radians)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)

    # Haversine
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    distance = R * c

    return distance


def get_nearby_reports(
    current_lat, current_lon, current_report_id, lookback_minutes=60, radius_km=10
):
    """Query recent reports from GSI1 and return reports within radius_km."""
    now = datetime.now(timezone.utc)
    lookback_time = (
        (now - timedelta(minutes=lookback_minutes)).isoformat().replace("+00:00", "Z")
    )

    # Fetch items
    try:
        response = table.query(
            IndexName="GSI1",
            KeyConditionExpression=("GSI1PK = :pk AND GSI1SK >= :lookback_timestamp"),
            ExpressionAttributeValues={
                ":pk": "REPORT",
                ":lookback_timestamp": lookback_time,
            },
        )
        items = response.get("Items", [])
    except ClientError as e:
        print(f"Error querying DynamoDB GSI1: {e}")
        return []

    nearby_reports = []
    for item in items:
        # Extract report ID from SK or GSI1SK
        sk = item.get("SK", "")
        item_report_id = sk.split("#")[1] if "#" in sk else ""

        # Skip the report created by the current invocation
        if item_report_id == current_report_id:
            continue

        item_lat = item.get("latitude")
        item_lon = item.get("longitude")

        # Skip broken entries
        if item_lat is None or item_lon is None:
            continue

        # Calculate distance between user and the nearby report
        dist = haversine_km(current_lat, current_lon, item_lat, item_lon)

        # If within 10km, add to the list
        if dist <= radius_km:
            nearby_reports.append(
                {
                    "reportID": item_report_id,
                    "latitude": float(item_lat),
                    "longitude": float(item_lon),
                    "timestamp": item.get("timestamp"),
                    "distanceKm": round(dist, 2),
                }
            )

    print(f"Raw items found in GSI1: {len(items)}")

    return nearby_reports

def has_recent_report(user_id, lookback_minutes=15):
    """
    Check whether the authenticated user has submitted a report
    within the last `lookback_minutes` minutes.
    """
    # Get 15 minute lookback time offset
    now = datetime.now(timezone.utc)
    lookback_time = now - timedelta(minutes=lookback_minutes)

    try:
        # Get all reports from the user by the timestamp
        response = table.query(
            KeyConditionExpression="PK = :pk",
            ExpressionAttributeValues={
                ":pk": f"USER#{user_id}",
            },
            ProjectionExpression="#ts",
            ExpressionAttributeNames={
                "#ts": "timestamp",
            },
        )

        # Iterate through returned reports, checking for reports made in the last 15 minutes
        for item in response.get("Items", []):
            timestamp_string = item.get("timestamp")

            if not timestamp_string:
                continue

            try:
                report_time = datetime.fromisoformat(
                    timestamp_string.replace("Z", "+00:00")
                )
            except ValueError:
                continue

            if report_time >= lookback_time:
                return True

        return False

    except ClientError as e:
        print(f"Error checking for recent report: {e}")
        raise


# This function is to be triggered when a user clicks the "I Felt That" button
# Parameters:
#   event: JSON body containing a value for "latitude" and a value for "longitude"
# Returns:
#   - the user's report details added to the table
#   - the number of nearby reports
#   - db items of those nearby reports, including how far they are from the user
def lambda_handler(event, context):

    # Get the Cognito identity
    claims = event.get("requestContext", {}).get("authorizer", {}).get("claims", {})

    # Should pull the userID from the Cognito claim
    user_id = claims.get("sub")

    # Error status if an authenticated user is not found e.g. no userID
    if not user_id:
        return {
            "statusCode": 401,
            "headers": CORS_HEADERS,
            "body": json.dumps({"message": "Unable to determine authenticated user"}),
        }

    # Parse the request body to body var, error if invalid body
    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return {
            "statusCode": 400,
            "headers": CORS_HEADERS,
            "body": json.dumps({"message": "Invalid JSON"}),
        }

    # Get latitude and longitude from the request
    latitude = body.get("latitude")
    longitude = body.get("longitude")

    if latitude is None or longitude is None:
        return {
            "statusCode": 400,
            "headers": CORS_HEADERS,
            "body": json.dumps({"message": "latitude and longitude are required"}),
        }

    # Convert to Decimal for DynamoDB
    try:
        latitude = Decimal(str(latitude))
        longitude = Decimal(str(longitude))
    except (InvalidOperation, ValueError, TypeError):
        return {
            "statusCode": 400,
            "headers": CORS_HEADERS,
            "body": json.dumps(
                {"message": "latitude and longitude must be valid numbers"}
            ),
        }

    # Generate a report ID
    report_id = str(uuid.uuid4())
    # Generate a timestamp for the report
    timestamp = (
        datetime.now(timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )

    # Fetch nearby active reports to serve to frontend
    nearby_reports = get_nearby_reports(
        current_lat=latitude,
        current_lon=longitude,
        current_report_id=report_id,
        lookback_minutes=60,
        radius_km=10,
    )

    # Prevent the user from submitting more than one report within a 15-minute window.
    if has_recent_report(user_id, lookback_minutes=15):
        return {
            "statusCode": 429,
            "headers": CORS_HEADERS,
            "body": json.dumps(
                {
                    "message": "You have already submitted a report within the last 15 minutes",
                    "nearbyReportCount": len(nearby_reports),
                    "nearbyReports": nearby_reports,
                }
            ),
        }

    # Creating a report item to write to DynamoDB
    item = {
        # Primary and Sort keys, user_id pulled from Cognito and report_id generated by this lambda
        "PK": f"USER#{user_id}",
        "SK": f"REPORT#{report_id}",
        # Global Secondary Index to query for all reports, timestamp SK to sort or filter by timestamp range
        "GSI1PK": "REPORT",
        "GSI1SK": f"{timestamp}#{report_id}",
        # Report content
        "entity_type": "REPORT",
        # Lat and Long pulled from request
        "latitude": latitude,
        "longitude": longitude,
        # Values to be modified by the Verifier script
        "mmi_value": None,
        "notification": "unsent",
        "publicID": None,
        "timestamp": timestamp,
        "verified": False,
        "verified_at": None,
    }

    # Conditional write to avoid overwrites
    try:
        table.put_item(
            Item=item,
            ConditionExpression=(
                # If the PK and SK both have a match there is already a report with this ID for this user
                "attribute_not_exists(PK) AND attribute_not_exists(SK)"
            ),
        )

    # Error handling
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return {
                "statusCode": 409,
                "headers": CORS_HEADERS,
                "body": json.dumps({"message": "Report already exists"}),
            }

        raise

    # Request response to return to REACT app
    return {
        "statusCode": 201,
        "headers": CORS_HEADERS,
        "body": json.dumps(
            {
                "message": "Report created",
                "reportID": report_id,
                "timestamp": timestamp,
                "nearbyReportCount": len(nearby_reports),
                "nearbyReports": nearby_reports,
            }
        ),
    }
