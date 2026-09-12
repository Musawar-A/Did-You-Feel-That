import boto3

"""
THIS IS FOR LOCAL TESTING ONLY!
This script prints out the contents of the local database.
This is just so we can check if verifier works.
"""

dynamodb = boto3.resource(
    "dynamodb",
    endpoint_url="http://localhost:8000",
    region_name="us-east-1",
    aws_access_key_id="dummy",
    aws_secret_access_key="dummy",
)

table = dynamodb.Table("DYFT-Checkins")
response = table.scan()


def inspect_db():
    print(f"Total Items: {response['Count']}")
    for item in response.get("Items", []):
        print(item)


if __name__ == "__main__":
    inspect_db()
