import json
import math
import os
import urllib.request
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Attr

LAMBDA_NAME = "DYFT-SeismicVerifier"
DB_TABLE_NAME = "DYFT-DataYouFeelThat"

# DynamoDB
dynamodb = boto3.resource("dynamodb", region_name="us-east-1")
table = dynamodb.Table(DB_TABLE_NAME)

# For verified earthquakes, use quake with minimum MMI=4
GEONET_MMI_URL = "https://api.geonet.org.nz/quake?MMI=4"


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


def get_geonet_features(minutes):
    """
    Obtain features from GeoNet:
    Latitude, Longitude, MMI >= 4, Quality = not deleted
    For verified earthquakes from the past 30 minutes

    Note: For Testing, use 14400 for past 10 days or 7200 for past 5 days, otherwise change to 30.
    minutes can be changed in the Lambda's Environment Variables
    """
    req = urllib.request.Request(GEONET_MMI_URL, headers={"User-Agent": LAMBDA_NAME})

    cutoff_time = datetime.now(timezone.utc) - timedelta(minutes=minutes)

    try:
        with urllib.request.urlopen(req) as response:
            if response.status == 200:
                data = json.loads(response.read().decode("utf-8"))
                verified_quakes = []

                # Go through GeoNet data
                for f in data.get("features", []):
                    props = f.get("properties", {})
                    mmi = props.get("mmi", 0)
                    quality = props.get("quality", "")
                    time_string = props.get("time")
                    locality = props.get("locality", "")

                    # Filter out deleted/non-verified items and MMI < 4
                    if quality not in ["best", "reviewed", "automatic", "preliminary"]:
                        continue
                    if not (4 <= mmi <= 8):
                        continue

                    # Filter last 30 minutes
                    if time_string:
                        quake_time = datetime.fromisoformat(
                            time_string.replace("Z", "+00:00")
                        )
                        if quake_time < cutoff_time:
                            continue

                    # Otherwise, save features
                    coords = f.get("geometry", {}).get("coordinates", [])
                    if len(coords) >= 2:
                        verified_quakes.append(
                            {
                                "publicID": props.get("publicID"),
                                "lat": coords[1],
                                "lon": coords[0],
                                "mmi": mmi,
                                "quality": quality,
                                "time": time_string,
                                "locality": locality,
                            }
                        )

                return verified_quakes
    except Exception as e:
        print(f"Error calling GeoNet API: {e}")
    return []


def get_mock_geonet_features(minutes=30):
    """
    FOR TESTING ONLY
    Creates a mock verified earthquake.
    Used to test if verifier works (flipping the verifier bool).
    """
    return [
        {
            "publicID": "test_quake_001",
            "lat": -37.787,  # e.g., Hamilton, NZ
            "lon": 175.304,
            "mmi": 5,
            "quality": "best",
            "time": "2026-09-12T07:00:00.000Z",
        }
    ]


def lambda_handler(event, context):
    """
    This Lambda Function is triggered every 15 minutes by EventBridge.
    GeoNet features are obtained through their API. These features are
    then compared to the reports made by users from the last 30 minutes.

    All reports that are within the area of a verified earthquake (MMI >= 4)
    are flagged by this Lambda Function. Their report entries' `verified`
    fields are marked `true` which flags them for notifications by
    the Notifier Lambda.
    """
    USE_MOCK_DATA = os.getenv("USE_MOCK_DATA", "false").lower() == "true"
    LOOKBACK_MINUTES = int(os.getenv("LOOKBACK_MINUTES", "30"))

    # Get features
    if USE_MOCK_DATA:
        features = get_mock_geonet_features()
    else:
        features = get_geonet_features(minutes=LOOKBACK_MINUTES)

    fifteen_mins_ago = (datetime.now(timezone.utc) - timedelta(minutes=15)).isoformat()

    # Filter strictly for unverified REPORT items in the single-table layout
    response = table.scan(
        FilterExpression=(
            Attr("entity_type").eq("REPORT")
            & Attr("verified").eq(False)
            & Attr("timestamp").gte(fifteen_mins_ago)
        )
    )
    unverified_reports = response.get("Items", [])
    verified_count = 0

    # For each unverified report
    for report in unverified_reports:
        u_lat, u_lon = float(report["latitude"]), float(report["longitude"])
        pk = report["PK"]
        sk = report["SK"]

        # For each feature
        for feat in features:
            # If < 50km (haversine)
            if haversine_km(u_lat, u_lon, feat["lat"], feat["lon"]) <= 50.0:
                # Update verified bool
                table.update_item(
                    Key={"PK": pk, "SK": sk},
                    UpdateExpression="SET verified = :v, mmi_value = :m, verified_at = :t, publicID = :p",
                    ExpressionAttributeValues={
                        ":v": True,
                        ":m": Decimal(str(feat["mmi"])),
                        ":t": datetime.now(timezone.utc).isoformat(),
                        ":p": feat["publicID"],
                    },
                )
                verified_count += 1
                break

    return {
        "statusCode": 200,
        "body": json.dumps(
            {
                "processed": len(unverified_reports),
                "verified": verified_count,
            }
        ),
    }
