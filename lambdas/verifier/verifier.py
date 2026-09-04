import json
import urllib.request


def fetch_live_geonet_data():
    """Fetch real-time sensor measurements from GeoNet REST API"""
    url = "https://api.geonet.org.nz//intensity?type=measured"
    """
    /intensity?type=(measured|reported)[&aggregation=(max|median)][&publicID=(publicID)]
    no public ID = info obtained will be from the last hour
    """
    headers = {"Accept": "application/vnd.geo+json;version=2"}

    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as response:
            if response.status == 200:
                data = json.loads(response.read().decode("utf-8"))
                return data.get("features", [])
    except Exception as e:
        print(f"Error connecting to Geonet: {e}")
        return []


def lambda_handler(event, context):
    """Entry point for AWS Lambda"""
    print("Starting GeoNet seismic verification process...")

    sensors = fetch_live_geonet_data()
    print(f"Retrieved {len(sensors)} active sensor readings.")

    # Mock data (with UoW coords for future reference)
    # TODO: Replace with a `boto3`db call that scans DynamoDB for real unverified user check-ins.
    mock_checkins = [
        {
            "checkin_id": "test_user",
            "latitude": -37.7855,
            "longitude": 175.3083,
            "verified": False,
        }
    ]

    processed_count = 0
    for report in mock_checkins:
        # TODO: Add the Haversine (formula) distance algorithm here to calculate distance between
        # each user check-in point (lat, lon) and every station point in `sensors`
        # TODO: If sensor reading falls within x km of a user check-in and records an intensity value MMI >= 4,
        # set verified = True, then update the record in DynamoDB
        report["verified"] = True
        processed_count += 1

    return {
        "statusCode": 200,
        "body": json.dumps(
            {"message": f"Successfully processed {processed_count} check-ins."}
        ),
        "DEV LOG": "!!!REMOVE THIS!!! Note: this is just to test if we can connect to the API. Processed count is mock data!",
    }


# Local test trigger
if __name__ == "__main__":
    result = lambda_handler(event={}, context=None)
    print("Results:", result)
