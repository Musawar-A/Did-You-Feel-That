import json
# import os
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

# Toggle local vs cloud, same pattern as verifier.py.
# Change this to False (or set env var USE_LOCAL_DB=false) to use AWS DynamoDB.
# USE_LOCAL_DB = os.getenv("USE_LOCAL_DB", "true").lower() == "true"
USE_LOCAL_DB = False 
TABLE_NAME = "DYFT-USERS"

if USE_LOCAL_DB:
    dynamodb = boto3.resource(
        "dynamodb",
        endpoint_url="http://localhost:8000",
        region_name="us-east-1",
        aws_access_key_id="dummy",
        aws_secret_access_key="dummy",
    )
else:
   dynamodb = boto3.resource("dynamodb", region_name="us-east-1")

table = dynamodb.Table(TABLE_NAME)
   
def _response(status_code, body_dict):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "https://didyoufeelthat.devs.surf",
            },
        "body": json.dumps(body_dict),
    }

def create_user_item(user_id, email, username):
    now = datetime.now(timezone.utc).isoformat()
    item = {
        "USER#": f"USER#{user_id}",
        "email": email,
        "username": username,
        "createdAt": now,
    }
    return item

def lambda_handler(event, context):
    try:
        claims = event["requestContext"]["authorizer"]["claims"] #identiy from AWS GateWayCognito authorizer comes from claims
    except (KeyError, TypeError):
        # this should never happen if the Cognito authorizer is attached correctly,
        # but fail closed rather than continuing with no identity.
        return _response(401, {"error": "Missing or invalid authorization claims"})

    user_id = claims.get("sub")
    email = claims.get("email")
    username = claims.get("cognito:username")

    if not user_id:
        return _response(401, {"error": "Token missing sub claim"})

    item = create_user_item(user_id, email, username)
  
    #user already exists write to database, if not ignore. 
    try:
        table.put_item(
            Item=item,
            ConditionExpression="attribute_not_exists(#pk)",
            ExpressionAttributeNames={
                "#pk": "USER#"
            }
        )
        return _response(201, {"message": "User created"})
    except ClientError as e:
        error_code = e.response["Error"]["Code"]

        if error_code == "ConditionalCheckFailedException":
            return _response(200, {"message": "User already exists"}) #user already exists = ignore

        # Anything else is unexpected - log detail server-side, keep response generic.
        return _response(500, {"error": "Internal server error"})

if __name__ == "__main__":
    # Quick local smoke test with a fake event.
    fake_event = {
        "requestContext": {
            "authorizer": {
                "claims": {
                    "sub": "test-sub-001",
                    "email": "test@example.com",
                    "cognito:username": "testuser",
                }
            }
        }
    }
    fake_event2 = {
        "requestContext": {
            "authorizer": {
                "claims": {
                    "sub": "test-sub-002",
                    "email": "test2@example.com",
                    "cognito:username": "testuser2",
                }
            }
        }
    }
    print(f"Running ingestion locally (Local DB: {USE_LOCAL_DB})...")
    print("Result:", lambda_handler(fake_event, None))
    print("Result:", lambda_handler(fake_event2, None))