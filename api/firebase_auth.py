import firebase_admin
from firebase_admin import credentials, auth
import os
import json
import logging
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Initialize Firebase Admin SDK
def initialize_firebase():
    try:
        # Check if Firebase app is already initialized
        if not firebase_admin._apps:
            service_account_value = os.getenv('FIREBASE_SERVICE_ACCOUNT_JSON')

            if not service_account_value:
                logger.error("FIREBASE_SERVICE_ACCOUNT_JSON environment variable not set.")
                raise ValueError("FIREBASE_SERVICE_ACCOUNT_JSON environment variable not set.")

            # On serverless hosts (Vercel etc.) there's no key file to point at,
            # so the env var can hold the service account JSON directly instead of a path.
            stripped = service_account_value.strip()
            if stripped.startswith('{'):
                try:
                    cred = credentials.Certificate(json.loads(stripped))
                    logger.info("Successfully loaded Firebase credentials from inline JSON env var.")
                except Exception as e:
                    logger.error(f"Error parsing inline Firebase credentials JSON: {str(e)}")
                    raise
            else:
                service_account_path = stripped

                # For Linux server, handle Windows-style paths if present
                if service_account_path.startswith('C:'):
                    # Extract just the filename and look in the current directory
                    filename = os.path.basename(service_account_path)
                    service_account_path = os.path.join(os.getcwd(), filename)
                    logger.info(f"Using local service account file: {service_account_path}")

                # Normalize the path for the current OS
                service_account_path = os.path.normpath(service_account_path)

                if not os.path.exists(service_account_path):
                    # Try to find the file in the current directory
                    filename = os.path.basename(service_account_path)
                    local_path = os.path.join(os.getcwd(), filename)
                    if os.path.exists(local_path):
                        service_account_path = local_path
                        logger.info(f"Found service account file at: {service_account_path}")
                    else:
                        logger.error(f"Firebase service account file not found at: {service_account_path}")
                        logger.error(f"Current working directory: {os.getcwd()}")
                        logger.error(f"Files in current directory: {os.listdir(os.getcwd())}")
                        raise FileNotFoundError(f"Firebase service account file not found at: {service_account_path}")

                try:
                    # Initialize with the service account file
                    cred = credentials.Certificate(service_account_path)
                    logger.info(f"Successfully loaded Firebase credentials from: {service_account_path}")
                except Exception as e:
                    logger.error(f"Error loading Firebase credentials: {str(e)}")
                    raise
            
            # Initialize the app with the credentials
            firebase_admin.initialize_app(cred, {
                'storageBucket': os.getenv('FIREBASE_STORAGE_BUCKET')
            })
            
            logger.info("Firebase Admin SDK initialized successfully.")
        else:
            logger.info("Firebase Admin SDK already initialized.")
            
    except Exception as e:
        logger.error(f"Error initializing Firebase: {str(e)}")
        raise

# Initialize Firebase when this module is imported
initialize_firebase()

async def verify_firebase_token(token: str) -> dict:
    try:
        logger.debug(f"Attempting to verify token: {token[:20]}...")
        decoded_token = auth.verify_id_token(token)
        logger.debug("Token verified successfully")
        return decoded_token
    except Exception as e:
        logger.error(f"Token verification failed: {str(e)}")
        raise ValueError(f"Invalid token: {str(e)}")
