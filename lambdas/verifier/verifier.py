import json
import math
import os
import urllib.request
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Attr

# Toggle local vs cloud
USE_LOCAL_DB = os.getenv("USE_LOCAL_DB", "true").lower() == "true"

if USE_LOCAL_DB:
    dynamodb = boto3.resource(
        "dynamodb",
        endpoint_url="http://localhost:8000",
        region_name="us-east-1",
        aws_access_key_id="dummy",
        aws_secret_access_key="dummy",
    )
else:
    # For local-to-cloud testing. Change profile name to whatever you have set up on your device
    session = boto3.Session(profile_name="dyft-dev", region_name="us-east-1")
    dynamodb = session.resource("dynamodb")

table = dynamodb.Table("DYFT-Checkins")
GEONET_MMI_URL = "https://api.geonet.org.nz/intensity?type=measured"


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


def get_geonet_features():
    """
    Obtain features from GeoNet:
    Latitude, Longitude, MMI >= 4
    """
    req = urllib.request.Request(
        GEONET_MMI_URL, headers={"User-Agent": "DYFT-SeismicVerifier"}
    )

    try:
        with urllib.request.urlopen(req) as response:
            if response.status == 200:
                data = json.loads(response.read().decode("utf-8"))
                return [
                    {
                        "lat": f["geometry"]["coordinates"][1],
                        "lon": f["geometry"]["coordinates"][0],
                        "mmi": f["properties"]["mmi"],
                    }
                    for f in data.get("features", [])
                    if f["properties"].get("mmi", 0) >= 4
                ]
    except Exception as e:
        print(f"Error calling GeoNet API: {e}")
    return []


def lambda_handler(event, context):
    # Get features
    features = get_geonet_features()

    print(f"# of features with MMI>=4: {len(features)}")

    print("Sample output:")
    print(json.dumps(features[:10], indent=2))

    # Filter strictly for unverified CHECKIN items in the single-table layout

    # For each unverified report
    # For each feature
    # If < 50km (haversine)
    # Update verified bool

    return {
        "statusCode": 200,
        "body": json.dumps(
            {
                "message": "Debug execution done!",
                "feature_cound": len(features),
                "sample": features[:10],
            }
        ),
    }


if __name__ == "__main__":
    # print(f"Running verifier locally (Local DB: {USE_LOCAL_DB})...")
    print("Result:", lambda_handler({}, None))
