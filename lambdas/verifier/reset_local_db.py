import boto3

"""
THIS IS FOR LOCAL TESTING ONLY!
This script removes the contents of the local database.
This is just so we can redo local tests with mock data.
"""

dynamodb = boto3.resource(
    "dynamodb",
    endpoint_url="http://localhost:8000",
    region_name="us-east-1",
    aws_access_key_id="dummy",
    aws_secret_access_key="dummy",
)

table = dynamodb.Table("DYFT-Checkins")


def clear_all_items():
    # Scan for all items to get their keys
    response = table.scan(ProjectionExpression="PK, SK")
    items = response.get("Items", [])

    if not items:
        print("Table is already empty.")
        return

    # Delete items in batches
    with table.batch_writer() as batch:
        for item in items:
            batch.delete_item(Key={"PK": item["PK"], "SK": item["SK"]})

    print(f"Deleted {len(items)} items from 'DYFT-Checkins'.")


if __name__ == "__main__":
    clear_all_items()
