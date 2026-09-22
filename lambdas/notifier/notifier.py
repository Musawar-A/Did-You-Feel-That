import json
import os

import boto3

LAMBDA_NAME = "DYFT-Notifier"

dynamodb = boto3.resource("dynamodb", region_name="us-east-1")

users_table = dynamodb.Table("DYFT-USERS")

ses = boto3.client(
    "ses",
    region_name="us-east-1"
)

def lambda_handler(event, context):

    for record in event["Records"]:

        try:
            # Get message from SQS
            message = json.loads(record["body"])

            user_id = message["user_id"]
            report_id = message["report_id"]

            print(
                f"Processing notification for "
                f"user={user_id}, report={report_id}"
            )

            # Get user from DynamoDB
            response = users_table.get_item(
                Key={
                    "user_id": user_id
                }
            )

            # User doesn't exist
            if "Item" not in response:
                raise Exception(
                    f"User {user_id} not found in DynamoDB"
                )

            user = response["Item"]
            # Get email
            email = user.get("email")

            if not email:
                raise Exception(
                    f"User {user_id} does not have an email address"
                )

            # Send email through SES
            ses.send_email(
                Source="verified@yourdomain.com",

                Destination={
                    "ToAddresses": [email]
                },

                Message={
                    "Subject": {
                        "Data": "Your Did You Feel That report has been verified",
                        "Charset": "UTF-8"
                    },

                    "Body": {
                        "Text": {
                            "Data": (
                                f"Your report {report_id} "
                                "has been verified against GeoNet earthquake data as a legitimate earthquake."
                            ),
                            "Charset": "UTF-8"
                        }
                    }
                }
            )

            print(
                f"Successfully sent verification email "
                f"to {email} for report {report_id}"
            )

        except Exception as e:

            print(
                f"Error processing SQS message: {e}"
            )

            # Re-raise the exception.
            # This tells Lambda/SQS that processing failed, so SQS can retry the message.
            raise

    return {
        "statusCode": 200,
        "body": json.dumps(
            "Notification processing complete"
        )
    }
