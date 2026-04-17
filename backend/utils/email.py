"""Email utility functions"""
import os
import logging

logger = logging.getLogger(__name__)

# SMTP / SES Configuration
SMTP_FROM = os.environ.get('SMTP_FROM', '')
AWS_ACCESS_KEY_ID = os.environ.get('AWS_ACCESS_KEY_ID', '')
AWS_SECRET_ACCESS_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY', '')
AWS_REGION = os.environ.get('AWS_REGION', 'us-east-1')


async def send_email(to_email: str, subject: str, html_body: str):
    """Send an email via AWS SES boto3 API."""
    try:
        import boto3
        ses_client = boto3.client(
            'ses',
            region_name=AWS_REGION,
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY
        )
        response = ses_client.send_email(
            Source=SMTP_FROM,
            Destination={'ToAddresses': [to_email]},
            Message={
                'Subject': {'Data': subject, 'Charset': 'UTF-8'},
                'Body': {'Html': {'Data': html_body, 'Charset': 'UTF-8'}}
            }
        )
        logger.info(f"Email sent to {to_email}: {subject} (MessageId: {response.get('MessageId')})")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        return False
