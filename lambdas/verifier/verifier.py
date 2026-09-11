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
    # TODO: Implement haversine
    return NotImplementedError


def get_geonet_features():
    """
    Obtain features from GeoNet:
    Latitude, Longitude, MMI >= 4
    """
    # TODO: Implement method
    return NotImplementedError


def lambda_handler(event, context):
    # Get features

    # Filter strictly for unverified CHECKIN items in the single-table layout

    # For each unverified report
    # For each feature
    # If < 50km (haversine)
    # Update verified bool

    return NotImplementedError


if __name__ == "__main__":
    print(f"Running verifier locally (Local DB: {USE_LOCAL_DB})...")
    print("Result:", lambda_handler({}, None))
