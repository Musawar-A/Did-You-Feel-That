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
    table.put_item(
        Item={
            "PK": "CHECKIN#rep_hamilton_001",
            "SK": "REPORT#2026-09-11T01:00:00Z",
            "entity_type": "CHECKIN",
            "latitude": Decimal("-37.7870"),
            "longitude": Decimal("175.3040"),
            "timestamp": "2026-09-11T01:00:00Z",
            "verified": False,
        }
    )
    print("Mock check-in data inserted successfully.")


if __name__ == "__main__":
    init_db()
