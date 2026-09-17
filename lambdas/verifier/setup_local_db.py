from datetime import datetime, timezone
from decimal import Decimal

import boto3

"""
THIS IS FOR LOCAL TESTING ONLY!
This script mocks what our cloud DynamoDB table would look like.
Once we have DynamoDB setup and our fields finalised, change this so your local tests would follow the same data types.
"""

dynamodb = boto3.resource(
    "dynamodb",
    endpoint_url="http://localhost:8000",
    region_name="us-east-1",
    aws_access_key_id="dummy",
    aws_secret_access_key="dummy",
)


def init_db():
    try:
        table = dynamodb.create_table(
            TableName="DYFT-Checkins",
            KeySchema=[
                {"AttributeName": "PK", "KeyType": "HASH"},  # Partition Key
                {"AttributeName": "SK", "KeyType": "RANGE"},  # Sort Key
            ],
            AttributeDefinitions=[
                {"AttributeName": "PK", "AttributeType": "S"},
                {"AttributeName": "SK", "AttributeType": "S"},
            ],
            ProvisionedThroughput={"ReadCapacityUnits": 5, "WriteCapacityUnits": 5},
        )
        table.wait_until_exists()
        print("Table 'DYFT-Checkins' created locally with PK and SK.")
    except Exception as e:
        print(
            f"Table notification: {e}. If you're running this after resetting local DB, you can ignore this message."
        )
        table = dynamodb.Table("DYFT-Checkins")

    # Seed a mock unverified report using PK and SK
    timenow = datetime.now(timezone.utc).isoformat()
    table.put_item(
        Item={
            "PK": "REPORT#rep_hamilton_001",
            "SK": "REPORT#" + timenow,
            "entity_type": "REPORT",
            "reportID": "rep_test_001",
            "userID": "user_test_98",
            "timestamp": timenow,
            "latitude": Decimal("-37.7870"),
            "longitude": Decimal("175.3040"),
            "verified": False,
            "notification": "unsent",
        }
    )
    # Add more here. You can add verified GeoNet stuff to test.
    table.put_item(
        Item={
            "PK": "REPORT#rep_tamarunui_002",
            "SK": "REPORT#2026-09-11T04:30:00Z",
            "entity_type": "REPORT",
            "reportID": "rep_test_002",
            "userID": "user_test_99",
            "timestamp": timenow,
            "latitude": Decimal("-38.9744"),
            "longitude": Decimal("175.2558"),
            "verified": False,
            "notification": "unsent",
        }
    )
    print("Mock check-in data inserted successfully.")


if __name__ == "__main__":
    init_db()
