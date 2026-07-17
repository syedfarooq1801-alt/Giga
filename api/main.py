from fastapi import FastAPI, HTTPException, UploadFile, File, Depends, Request, Body, status, Header
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import uuid  # Added for generating unique IDs
import logging # Added for logging
from datetime import datetime # Added for timestamp generation
from pydantic import BaseModel
from firebase_admin import auth, firestore
from firebase_admin.exceptions import FirebaseError
from firebase_auth import verify_firebase_token
from groq_handler import get_groq_response, get_groq_response_stream
from personalities import get_personality_context
from firebase_memory_manager import (
    store_message,
    get_chat_history,
    get_chat_messages,
    update_chat_title,
    delete_chat
)


# --- GREETING KEYWORDS ---


# --- GREETING KEYWORDS ---

# from meme_uploader import upload_meme, get_memes
# from stt_handler import stt, stt_from_mic
# from tts_handler import speak
from config import UPLOAD_DIR, FIREBASE_PROJECT_ID, FIREBASE_API_KEY
from dotenv import load_dotenv
import os
import json
import re
import time
import asyncio
import uuid
from datetime import datetime
from typing import Optional, Dict, List, Any, Union
import httpx
from functools import lru_cache
import subprocess
import traceback
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

api_app = FastAPI(title="GigaBhai API")

# Configure CORS middleware for VPS deployment
api_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Test endpoint to verify CORS is working
@api_app.get("/test-cors")
async def test_cors():
    return {"message": "CORS is working!"}


# CORS is already configured above with the app.add_middleware() call

# --- COOKIE SETTING UTILITY ---
from fastapi import Response

def set_cross_site_cookie(response: Response, key: str, value: str, **kwargs):
    """
    Set a cookie with SameSite=None; Secure for cross-site usage (required for auth between Vercel and Render).
    """
    response.set_cookie(
        key=key,
        value=value,
        httponly=kwargs.get('httponly', True),
        secure=True,  # Required for cross-site
        samesite="none",  # Required for cross-site
        path=kwargs.get('path', "/"),
        expires=kwargs.get('expires'),
        max_age=kwargs.get('max_age'),
        domain=kwargs.get('domain'),
    )
# --- END COOKIE UTILITY ---

# --- REDIRECT SUGGESTION (VERCEL) ---
# To unify your domain and avoid subtle cookie/CORS issues, add this to vercel.json:
# {
#   "redirects": [
#     { "source": "https://gigabhai.com/:path*", "destination": "https://www.gigabhai.com/:path*", "permanent": true }
#   ]
# }
# --- END REDIRECT SUGGESTION ---

# Create uploads directory if it doesn't exist (best-effort — read-only on serverless)
try:
    os.makedirs(UPLOAD_DIR, exist_ok=True)
except OSError:
    pass

# Pydantic models
class ChatRequest(BaseModel):
    message: str
    personality: str
    conversation_id: Optional[str] = None
    is_new_conversation: bool = False

class ChatResponse(BaseModel):
    message: str
    timestamp: str
    personality: str
    conversation_id: Optional[str] = None  # Added conversation_id

class TokenData(BaseModel):
    token: str

class MemeUploadRequest(BaseModel):
    caption: str
    category: Optional[str] = None

class HeadingRequest(BaseModel):
    messages: List[str]

# Dependency to verify Firebase ID token and get user data
async def get_current_user(request: Request) -> Dict[str, Any]:
    """Verify Firebase ID token and return user data.
    
    Args:
        request: The incoming request
        
    Returns:
        Dict containing user data including uid and profile_id if available
        
    Raises:
        HTTPException: If authentication fails
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Extract the token from the header (format: "Bearer <token>")
    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format. Use 'Bearer <token>'",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    id_token = parts[1]
    
    try:
        # Verify the ID token using Firebase Admin SDK
        decoded_token = await verify_firebase_token(id_token)
        if not decoded_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Get the user record to access custom claims and other user data
        try:
            user = auth.get_user(decoded_token['uid'])
            user_data = {
                'uid': user.uid,
                'email': user.email,
                'email_verified': user.email_verified,
                'display_name': user.display_name,
                'phone_number': user.phone_number,
                'photo_url': user.photo_url,
                'disabled': user.disabled,
                'custom_claims': user.custom_claims or {}
            }
            
            # Add profile_id from custom claims if available
            if user.custom_claims and 'profile_id' in user.custom_claims:
                user_data['profile_id'] = user.custom_claims['profile_id']
            else:
                # Generate profile_id based on UID and provider ID for data isolation
                provider_id = None
                if user.provider_data and len(user.provider_data) > 0:
                    provider_id = user.provider_data[0].provider_id
                else:
                    # Default to 'firebase' if no provider data available
                    provider_id = 'firebase'
                
                # Create profile_id in format: uid_providerId
                profile_id = f"{user.uid}_{provider_id}"
                user_data['profile_id'] = profile_id
                
                # Try to save this profile_id to custom claims for future use
                try:
                    try:
                        claims = user.custom_claims if user.custom_claims else {}
                        claims['profile_id'] = profile_id
                        auth.set_custom_user_claims(user.uid, claims)
                        logging.info(f"Set profile_id in custom claims for user {user.uid}")
                    except Exception as e:
                        # Don't fail if we can't set custom claims, just log the error
                        logging.error(f"Failed to set custom claims: {str(e)}")
                except Exception as e:
                    # Don't fail if we can't set custom claims, just log the error
                    logging.error(f"Failed to set custom claims: {str(e)}")
            
            logging.info(f"User authenticated successfully: {user.uid} with profile_id: {user_data.get('profile_id')}")
            return user_data
        except ValueError as e:
            logging.error(f"Token verification failed: {str(e)}")
            raise HTTPException(
                status_code=401,
                detail=f"Invalid token: {str(e)}"
            )
    except ValueError as e:
        # Specific error for token validation failures
        logging.error(f"Token validation error: {str(e)}")
        raise HTTPException(
            status_code=401,
            detail=f"Invalid token: {str(e)}"
        )
    except Exception as e:
        # General error handling
        logging.error(f"Authentication error: {str(e)}")
        raise HTTPException(
            status_code=401,
            detail=f"Authentication failed: {str(e)}"
        )

# Cache for frequently asked questions
@lru_cache(maxsize=100000)
def get_cached_response(message: str, personality: str) -> Optional[str]:
    return None

# API endpoints

# @api_app.post("/upload-meme")
# async def upload_meme_endpoint(
#     file: UploadFile = File(...),
#     caption: str = Body(...),
#     category: Optional[str] = Body(None),
#     current_user: dict = Depends(get_current_user)
# ):
#     """
#     Upload a meme file to Firebase Storage and store its metadata in Firestore.
#     
#     The file is stored in a user-specific directory in the Firebase Storage bucket,
#     and metadata is stored in the 'memes' collection in Firestore.
#     """
#     try:
#         # Read file content
#         contents = await file.read()
#         
#         # Validate file size (e.g., 5MB max)
#         if len(contents) > 5 * 1024 * 1024:  # 5MB
#             raise HTTPException(
#                 status_code=status.HTTP_400_BAD_REQUEST,
#                 detail="File size exceeds maximum allowed size of 5MB"
#             )
#         
#         # Upload to Firebase Storage
#         result = await upload_meme(
#             file_data=contents,
#             file_name=file.filename,
#             content_type=file.content_type or "application/octet-stream",
#             user_id=current_user.get("uid"),
#             profile_id=current_user.get("profile_id"),
#             caption=caption,
#             category=category or "general"
#         )
#         
#         return {
#             "success": True,
#             "message": "File uploaded successfully",
#             "data": result
#         }
#         
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error uploading meme: {str(e)}")
#         logger.error(traceback.format_exc())
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail=f"Failed to upload file: {str(e)}"
#         )

# @api_app.get("/memes")
# async def get_memes_endpoint(
#     category: Optional[str] = None,
#     limit: int = 50,
#     current_user: dict = Depends(get_current_user)
# ):
#     """
#     Retrieve memes for the authenticated user from Firestore.
#     
#     Args:
#         category: Optional category filter
#         limit: Maximum number of memes to return (default: 50, max: 100)
#         current_user: The authenticated user from the dependency
#         
#     Returns:
#         List of meme metadata objects with public URLs
#     """
#     try:
#         # Validate limit
#         limit = max(1, min(limit, 100))  # Enforce reasonable limits
#         
#         # Get memes from Firebase
#         memes = await get_memes(
#             user_id=current_user.get("uid"),
#             profile_id=current_user.get("profile_id"),
#             category=category,
#             limit=limit
#         )
#         
#         return {
#             "success": True,
#             "count": len(memes),
#             "data": memes
#         }
#         
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error retrieving memes: {str(e)}")
#         logger.error(traceback.format_exc())
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail="Failed to retrieve memes"
#         )

# @api_app.delete("/memes/{meme_id}")
# async def delete_meme_endpoint(
#     meme_id: str,
#     current_user: dict = Depends(get_current_user)
# ):
#     """
#     Delete a meme from both Firebase Storage and Firestore.
#     
#     Only the owner of the meme can delete it.
#     """
#     try:
#         success = await delete_meme(
#             meme_id=meme_id,
#             user_id=current_user.get("uid"),
#             profile_id=current_user.get("profile_id")
#         )
#         
#         if not success:
#             raise HTTPException(
#                 status_code=status.HTTP_404_NOT_FOUND,
#                 detail="Meme not found or you don't have permission to delete it"
#             )
#             
#         return {
#             "success": True,
#             "message": "Meme deleted successfully"
#         }
#         
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error deleting meme {meme_id}: {str(e)}")
#         logger.error(traceback.format_exc())
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail="Failed to delete meme"
#         )

@api_app.get("/auth/test")
async def test_auth_endpoint(current_user: dict = Depends(get_current_user)):
    """
    Test endpoint to verify authentication is working correctly.
    This endpoint simply returns the user data if the token is valid.
    """
    return {
        "success": True,
        "message": "Authentication successful",
        "user": {
            "uid": current_user.get("uid"),
            "email": current_user.get("email"),
            "profile_id": current_user.get("profile_id"),
            "provider": current_user.get("provider_id"),
        }
    }

@api_app.post("/get-test-token")
async def get_test_token():
    try:
        # Try to get existing user or create new one
        try:
            user = auth.get_user_by_email("test@example.com")
        except auth.UserNotFoundError:
            user = auth.create_user(
                email="test@example.com",
                password="test123456"
            )
        
        # Get an ID token
        id_token = auth.create_custom_token(user.uid)
        
        # Exchange custom token for ID token
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key={FIREBASE_API_KEY}",
                json={"token": id_token.decode(), "returnSecureToken": True}
            )
            response_data = response.json()
            if "error" in response_data:
                raise HTTPException(status_code=500, detail=response_data["error"]["message"])
            return {"token": response_data["idToken"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_app.post("/send-otp")
async def send_otp(data: dict = Body(...)):
    phone = data.get("phone")
    if not phone:
        raise HTTPException(status_code=400, detail="Phone number required")
    # TODO: Integrate with real OTP service (e.g., Twilio, Firebase)
    # For now, just simulate success
    return {"success": True, "message": f"OTP sent to {phone}"}

@api_app.post("/verify-otp")
async def verify_otp(data: dict = Body(...)):
    phone = data.get("phone")
    otp = data.get("otp")
    if not phone or not otp:
        raise HTTPException(status_code=400, detail="Phone and OTP required")
    # TODO: Integrate with real OTP verification
    # For now, just simulate success and return a fake token
    return {"success": True, "token": "FAKE_TOKEN_FOR_DEMO"}

@api_app.post("/login-email")
async def login_email(data: dict = Body(...)):
    email = data.get("email")
    password = data.get("password")
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password required")
    # Use Firebase REST API to sign in
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}",
            json={"email": email, "password": password, "returnSecureToken": True}
        )
        response_data = response.json()
        if "error" in response_data:
            raise HTTPException(status_code=401, detail=response_data["error"]["message"])
        return {
            "success": True,
            "user": {"uid": response_data["localId"], "email": email},
            "token": response_data["idToken"]
        }

@api_app.post("/login-google")
async def login_google(data: dict = Body(...)):
    id_token = data.get("idToken")
    if not id_token:
        raise HTTPException(status_code=400, detail="Google ID token required")
    # Verify Google ID token with Firebase
    try:
        decoded_token = auth.verify_id_token(id_token)
        uid = decoded_token["uid"]
        # Create a custom token for this user
        custom_token = auth.create_custom_token(uid)
        return {"token": custom_token.decode() if hasattr(custom_token, 'decode') else custom_token}
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

@api_app.get("/personalities")
async def get_personalities():
    try:
        return {
            "personalities": [
                {
                    "id": "swag",
                    "name": "Swag Bhai",
                    "avatar": "🕶️",
                    "description": "Yo bro! Let's keep it real and swaggy!",
                    "theme": {
                        "primary": "#FF6B6B",
                        "secondary": "#4ECDC4",
                        "background": "#2D3436",
                        "text": "#FFFFFF"
                    }
                },
                {
                    "id": "ceo",
                    "name": "CEO Bhai",
                    "avatar": "👔",
                    "description": "Let's discuss business and success strategies.",
                    "theme": {
                        "primary": "#2D3436",
                        "secondary": "#0984E3",
                        "background": "#FFFFFF",
                        "text": "#2D3436"
                    }
                },
                {
                    "id": "roast",
                    "name": "Roast Bhai",
                    "avatar": "🔥",
                    "description": "Ready for some spicy roasts?",
                    "theme": {
                        "primary": "#E17055",
                        "secondary": "#FF7675",
                        "background": "#2D3436",
                        "text": "#FFFFFF"
                    }
                },
                {
                    "id": "vidhyarthi",
                    "name": "Vidhyarthi Bhai",
                    "avatar": "📚",
                    "description": "Let's learn and grow together!",
                    "theme": {
                        "primary": "#6C5CE7",
                        "secondary": "#A8E6CF",
                        "background": "#FFFFFF",
                        "text": "#2D3436"
                    }
                },
                {
                    "id": "jugadu",
                    "name": "Jugadu Bhai",
                    "avatar": "🔧",
                    "description": "Need a jugaad? I'm your guy!",
                    "theme": {
                        "primary": "#FDCB6E",
                        "secondary": "#00B894",
                        "background": "#FFFFFF",
                        "text": "#2D3436"
                    }
                }
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_app.post("/mistral-heading")
async def generate_heading(request: HeadingRequest):
    try:
        # Create a system prompt for title generation that focuses on content
        system_prompt = """You are a helpful assistant that generates extremely concise titles for conversations. 
        Focus ONLY on the main topic or theme discussed in the messages, ignoring any personality or style of communication.
        The title should be just 1-2 words that capture the essence of what was actually discussed.
        Use impactful, memorable words that reflect the content.
        Respond with ONLY the title, no additional text or explanation.
        Do not include personality names or styles in the title."""
        
        # Combine messages into a single context, focusing on the actual content
        conversation_context = "\n".join([
            msg for msg in request.messages 
            if not msg.startswith("[SPEECH]")  # Exclude speech indicators
        ])
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Generate a 1-2 word title that captures the main topic discussed in this conversation:\n{conversation_context}"}
        ]
        
        heading = await get_groq_response(messages)

        # Clean up the response to ensure it's just the title
        heading = heading.strip()
        if heading.startswith('"') and heading.endswith('"'):
            heading = heading[1:-1]

        # Ensure the heading is not too long (max 2 words)
        words = heading.split()
        if len(words) > 2:
            heading = " ".join(words[:2])

        return {"heading": heading}
    except Exception as e:
        print("Exception in /mistral-heading:", e)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@api_app.post("/groq-heading")
async def generate_groq_heading(request: HeadingRequest):
    try:
        # Create a system prompt for title generation that focuses on content
        system_prompt = """You are a helpful assistant that generates extremely concise titles for conversations. 
        Focus ONLY on the main topic or theme discussed in the messages, ignoring any personality or style of communication.
        The title should be just 1-2 words that capture the essence of what was actually discussed.
        Use impactful, memorable words that reflect the content.
        Respond with ONLY the title, no additional text or explanation.
        Do not include personality names or styles in the title."""
        
        # Combine messages into a single context, focusing on the actual content
        conversation_context = "\n".join([
            msg for msg in request.messages 
            if not msg.startswith("[SPEECH]")  # Exclude speech indicators
        ])
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Generate a 1-2 word title that captures the main topic discussed in this conversation:\n{conversation_context}"}
        ]
        
        heading = await get_groq_response(messages)
        
        # Clean up the response to ensure it's just the title
        heading = heading.strip()
        if heading.startswith('"') and heading.endswith('"'):
            heading = heading[1:-1]
        
        # Ensure the heading is not too long (max 2 words)
        words = heading.split()
        if len(words) > 2:
            heading = " ".join(words[:2])
        
        return {"heading": heading}
    except Exception as e:
        print("Exception in /groq-heading:", e)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# --- Response cleaning helpers, shared by /chat and /chat/stream ---

def clean_llm_response(response):
    """Clean and extract the assistant's response from the LLM output."""
    if isinstance(response, dict):
        if response.get("role") == "assistant":
            return response.get("content", "")
        return ""
    elif isinstance(response, list):
        # Find the first assistant message in the response
        assistant_responses = [
            m.get("content", "")
            for m in response
            if isinstance(m, dict) and m.get("role") == "assistant"
        ]
        return assistant_responses[0] if assistant_responses else ""
    return str(response) if response is not None else ""


def remove_user_message_references(response, user_msg):
    """Remove any references to the user's message in the response."""
    if not response or not user_msg:
        return response

    # Remove exact matches of the user's message
    cleaned = response.replace(user_msg, "")

    # Remove common patterns that include the user's message
    patterns = [
        f"You said: \"{user_msg}\"",
        f"When you said '{user_msg}'",
        f"Your message '{user_msg}'",
        f"You asked me to '{user_msg}'",
        f"You wanted me to '{user_msg}'",
    ]

    for pattern in patterns:
        cleaned = cleaned.replace(pattern, "")

    return cleaned.strip() or "Hmm, let's change the subject. What else is on your mind?"


def get_persona_name(pid):
    """Get the display name for the current persona."""
    return {
        "swag_bhai": "Swag Bhai",
        "ceo_bhai": "CEO Bhai",
        "roast_bhai": "Roast Bhai",
        "vidhyarthi_bhai": "Vidhyarthi Bhai",
        "jugadu_bhai": "Jugadu Bhai"
    }.get(pid, "Bhai")


def remove_meta_references(resp):
    """Remove any meta-references from the response."""
    if not resp:
        return resp

    # Remove common meta-references
    meta_phrases = [
        "As an AI language model",
        "I am an AI",
        "I'm an AI",
        "I am a language model",
        "I'm a language model",
        "I don't have personal experiences",
        "I don't have personal opinions",
        "I don't have personal feelings"
    ]

    cleaned = resp
    for phrase in meta_phrases:
        cleaned = cleaned.replace(phrase, "")

    return cleaned.strip()


async def _build_chat_messages(message: str, personality: str, conversation_id: str, current_user: dict):
    """
    Shared preamble for /chat and /chat/stream: resolves user/profile ids,
    fetches personality context + this conversation's history/compressed
    memory, and assembles the final messages list to send to the LLM.
    Pure/side-effect-free — runs identically and unconditionally before the
    LLM call in both endpoints.
    """
    user_id = current_user.get('uid')
    profile_id = current_user.get('profile_id')

    personality_context = get_personality_context(personality)

    # Get compressed memory or chat history for THIS conversation only
    chat_history = []
    if conversation_id:
        try:
            from firebase_memory_manager import get_compressed_memory, get_chat_messages
            # Only ever fetch memory/history for the current conversation_id
            compressed_memory = await get_compressed_memory(conversation_id, user_id, profile_id)
            if compressed_memory and isinstance(compressed_memory, list) and len(compressed_memory) > 0:
                chat_history = compressed_memory
            else:
                # Fallback: Fetch up to 100 previous messages for this conversation only
                chat_history = await get_chat_messages(
                    chat_id=conversation_id,
                    user_id=user_id,
                    profile_id=profile_id,
                    limit=100
                )
                chat_history.reverse()
                # Format fallback as role/content pairs
                formatted_fallback = []
                for msg in chat_history:
                    if msg.get('message'):
                        formatted_fallback.append({"role": "user", "content": msg['message']})
                    if msg.get('response'):
                        formatted_fallback.append({"role": "assistant", "content": msg['response']})
                chat_history = formatted_fallback[-20:]  # fallback to last 20 messages
        except Exception as e:
            logger.warning(f"Error fetching chat history or compressed memory: {str(e)}")
            chat_history = []
    # else: no conversation_id (new conversation) — DO NOT fetch any history or summary

    # Build the full context for the LLM (guaranteed to be scoped to this conversation only)
    messages = []

    # 1. Add personality context (system prompt and intro)
    if personality_context and isinstance(personality_context, list):
        for msg in personality_context:
            if isinstance(msg, dict) and 'role' in msg and 'content' in msg:
                messages.append({
                    "role": msg['role'],
                    "content": str(msg['content']) if not isinstance(msg['content'], str) else msg['content']
                })

    # 2. Add chat history (previous user and assistant messages)
    if chat_history and isinstance(chat_history, list):
        for msg in chat_history:
            if isinstance(msg, dict) and 'role' in msg and 'content' in msg:
                if msg['role'] in ['user', 'assistant']:
                    messages.append({
                        "role": msg['role'],
                        "content": str(msg['content']) if not isinstance(msg['content'], str) else msg['content']
                    })

    # 3. Add the current user message
    messages.append({"role": "user", "content": message})

    # Ensure last message role is 'user' or 'tool' (Groq/Mistral API requirement)
    if messages[-1]['role'] not in ["user", "tool"]:
        logger.warning(f"Last message role is {messages[-1]['role']}; appending user message to fix.")
        messages.append({"role": "user", "content": message})

    return messages, user_id, profile_id


# Add new endpoint for conversation management
@api_app.post("/chat")
@api_app.options("/chat", include_in_schema=False)
async def chat(
    request: Request, 
    current_user: dict = Depends(get_current_user),
    origin: str = Header(None, include_in_schema=False)
):
    """Handle chat messages and generate responses using Mistral.
    
    This endpoint processes incoming chat messages, retrieves conversation history,
    generates a response using Mistral, and stores the conversation in Firestore.
    """
    # Handle preflight OPTIONS request
    if request.method == "OPTIONS":
        response = JSONResponse(
            content={"message": "OK"}, 
            status_code=200
        )
        response.headers["Access-Control-Allow-Origin"] = origin or "*"
        response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        return response
    
    try:
        data = await request.json()
        message = data.get("message")
        personality = data.get("personality", "swag")
        conversation_id = data.get("conversation_id")
        if not conversation_id:
            conversation_id = str(uuid.uuid4())
            
        # Log the incoming request for debugging
        logger.info(f"Chat request - User: {current_user.get('uid')}, Conversation: {conversation_id}, Personality: {personality}")
        
        # Prepare response headers for CORS
        headers = {
            "Access-Control-Allow-Origin": origin or "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Allow-Credentials": "true"
        }

        if not message:
            # Defensive: Always return a valid conversation_id
            response = JSONResponse(
                content={
                    "message": "Message is required",
                    "conversation_id": conversation_id,
                    "timestamp": datetime.now().isoformat(),
                    "personality": personality
                },
                status_code=400
            )
            # Add CORS headers
            for key, value in headers.items():
                response.headers[key] = value
            return response

        # Specific response for Mythili L
        # Ensure 'message' is not None before calling strip() and lower()
        if message and message.strip().lower() == "i am mythili from tumkur":
            logger.info(f"Special message 'I am Mythili from Tumkur' received from user {current_user.get('uid')}")
            special_response_text = "ohh woww u r the friend of Syed Farooq and a heart broken ex of Harshith R how is life now"
            
            # This special response currently bypasses normal message storage in Firestore.
            # If you want this interaction to be saved, you would add calls to store_message here
            # for both the user's message and this AI response, ensuring conversation_id is handled.

            # Defensive: Always return a valid conversation_id
            if not conversation_id:
                conversation_id = str(uuid.uuid4())
            response = JSONResponse(
                content={
                    "message": special_response_text,
                    "timestamp": datetime.now().isoformat(),
                    "personality": personality,
                    "conversation_id": conversation_id
                },
                status_code=200
            )
            # Add CORS headers
            for key, value in headers.items():
                response.headers[key] = value
            return response
        
        messages, user_id, profile_id = await _build_chat_messages(message, personality, conversation_id, current_user)

        logger.info(f"Prompt sent to LLM (Groq): {json.dumps(messages, ensure_ascii=False, indent=2)}")
        response = None
        try:
            # Get response from Groq
            response = await get_groq_response(messages)

            # Clean and validate the response (helpers hoisted to module level,
            # shared with /chat/stream)
            response = clean_llm_response(response)
            response = str(response).strip() if response else "I'm not sure how to respond to that. Could you rephrase?"
            response = remove_user_message_references(response, message)
            
            persona_name = get_persona_name(personality)
            if response.lower().startswith(persona_name.lower() + ":"):
                response = response[len(persona_name) + 1:].strip()
            
            response = remove_meta_references(response)
            
        except Exception as e:
            logger.error(f"Error generating response with Groq: {str(e)}")
            logger.error(traceback.format_exc())
            response = "Hmm, let me think of a better response. Try asking me something else!"

        # Store the conversation in Firestore
        try:
            conversation_id = await store_message(
                user_id=user_id,
                profile_id=profile_id,
                personality=personality,
                message=message,
                response=response,
                chat_id=conversation_id
            )
        except Exception as e:
            logger.error(f"Error storing message in Firestore: {str(e)}")
            if '404' in str(e):
                logger.error(f"Firestore 404: Conversation document missing for chat_id={conversation_id}, user_id={user_id}, profile_id={profile_id}. This usually means the conversation was never created or was deleted.")
            # Don't fail the request if storage fails, just log it
            if not conversation_id:
                conversation_id = str(uuid.uuid4())
        
        # After storing, summarize the last 100 messages and store as compressed memory
        try:
            from firebase_memory_manager import get_chat_messages, store_compressed_memory
            from groq_memory import summarize_chat_memory
            last_100_msgs = await get_chat_messages(
                chat_id=conversation_id,
                user_id=user_id,
                profile_id=profile_id,
                limit=100
            )
            last_100_msgs.reverse()
            # Format as role/content pairs for summarization
            formatted_msgs = []
            for msg in last_100_msgs:
                user_message = msg.get('message')
                bot_response = msg.get('response')
                if user_message:
                    formatted_msgs.append({"role": "user", "content": user_message})
                if bot_response:
                    formatted_msgs.append({"role": "assistant", "content": bot_response})
            compressed_memory = await summarize_chat_memory(formatted_msgs)
            await store_compressed_memory(conversation_id, user_id, profile_id, compressed_memory)
        except Exception as e:
            logger.warning(f"Failed to summarize and store compressed memory: {str(e)}")
        
        # Sanitize the response to remove any mention of 'Mistral' or 'Mistral AI'
        if isinstance(response, str):
            forbidden_keywords = ["mistral ai", "mistral", "Mistral AI", "Mistral"]
            for keyword in forbidden_keywords:
                response = response.replace(keyword, "AI")
        if not response:
            response = "Sorry, the AI could not generate a response."

        # Defensive: Guarantee conversation_id is never None in the response
        if not conversation_id:
            conversation_id = str(uuid.uuid4())

        # Remove or rewrite any meta-prompt leakage (system log, prompt, LLM, etc.)
        if isinstance(response, str):
            meta_leak_phrases = [
                "system log", "prompt", "private LLM", "I'm just a computer program", "as an AI", "as an LLM", "I am an AI", "I am an LLM",
                "I'm running on", "I will never share my system log", "instructions", "meta", "I don't have feelings", "I don't have a body",
                "I'm here to help you with any questions or information you need."
            ]
            for phrase in meta_leak_phrases:
                if phrase.lower() in response.lower():
                    # Remove the phrase and any surrounding sentences
                    import re
                    response = re.sub(r'[^.]*' + re.escape(phrase) + r'[^.]*[.!?]', '', response, flags=re.IGNORECASE)
            # Clean up excessive whitespace
            response = response.strip()
        # --- END POST-PROCESSING ---
        # Create JSON response with CORS headers
        response_data = {
            "message": response,  # This is the sanitized AI message
            "timestamp": datetime.now().isoformat(),
            "personality": personality,  # Use the personality from the original request
            "conversation_id": conversation_id
        }
        
        # Create JSON response
        response = JSONResponse(
            content=response_data,
            status_code=200
        )
        
        # Add CORS headers
        headers = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Accept"
        }
        for key, value in headers.items():
            response.headers[key] = value
            
        logger.info(f"Outgoing ChatResponse (Success Path) for conversation_id {conversation_id}: {response_data}")
        return response

    except HTTPException as he:
        logger.error(f"HTTP error in chat endpoint: {str(he.detail)}")
        # Safely determine conversation_id and personality for the error response
        _conversation_id_for_error = str(uuid.uuid4()) # Default to new UUID
        if 'conversation_id' in locals() and locals().get('conversation_id'):
            _conversation_id_for_error = locals().get('conversation_id')
        
        _personality_for_error = "swag" # Default personality
        if 'personality' in locals() and locals().get('personality'):
            _personality_for_error = locals().get('personality')
        elif 'data' in locals() and isinstance(locals().get('data'), dict) and locals().get('data').get('personality'):
             _personality_for_error = locals().get('data').get('personality')

        # Create error response with CORS headers
        error_response = JSONResponse(
            content={
                "message": str(he.detail),
                "timestamp": datetime.now().isoformat(),
                "personality": _personality_for_error,
                "conversation_id": _conversation_id_for_error
            },
            status_code=he.status_code if hasattr(he, 'status_code') else 400
        )
        
        # Add CORS headers
        for key, value in headers.items():
            error_response.headers[key] = value
            
        return error_response
    except json.JSONDecodeError:
        logger.error("Invalid JSON in request body")
        # Create error response with CORS headers
        error_response = JSONResponse(
            content={
                "message": "Invalid JSON in request body",
                "timestamp": datetime.now().isoformat(),
                "personality": "swag",
                "conversation_id": str(uuid.uuid4())
            },
            status_code=400
        )
        
        # Add CORS headers
        if 'headers' in locals():
            for key, value in headers.items():
                error_response.headers[key] = value
                
        return error_response
    except Exception as e:
        logger.error(f"Unexpected error in chat endpoint: {str(e)}")
        logger.error(traceback.format_exc())
        # Safely determine conversation_id and personality for the error response
        _conversation_id_for_error = str(uuid.uuid4()) # Default to new UUID
        if 'conversation_id' in locals() and locals().get('conversation_id'):
            _conversation_id_for_error = locals().get('conversation_id')
        
        _personality_for_error = "swag" # Default personality
        if 'personality' in locals() and locals().get('personality'):
            _personality_for_error = locals().get('personality')
        elif 'data' in locals() and isinstance(locals().get('data'), dict) and locals().get('data').get('personality'):
             _personality_for_error = locals().get('data').get('personality')

        # Create error response with CORS headers
        error_response = JSONResponse(
            content={
                "message": f"An unexpected error occurred: {str(e)}",
                "timestamp": datetime.now().isoformat(),
                "personality": _personality_for_error,
                "conversation_id": _conversation_id_for_error
            },
            status_code=500
        )
        
        # Add CORS headers
        headers = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Accept"
        }
        for key, value in headers.items():
            error_response.headers[key] = value
                
        return error_response


@api_app.post("/chat/stream")
@api_app.options("/chat/stream", include_in_schema=False)
async def chat_stream(
    request: Request,
    current_user: dict = Depends(get_current_user),
    origin: str = Header(None, include_in_schema=False)
):
    """
    Streaming sibling of /chat: same auth, same message-building preamble,
    same response-cleaning pipeline and Firestore storage — but flushes the
    reply to the client sentence-by-sentence over SSE instead of making the
    browser wait for the whole thing. /chat itself is untouched and stays
    available as a non-streaming fallback.
    """
    cors_headers = {
        "Access-Control-Allow-Origin": origin or "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true",
    }

    if request.method == "OPTIONS":
        return JSONResponse(content={"message": "OK"}, status_code=200, headers=cors_headers)

    data = await request.json()
    message = data.get("message")
    personality = data.get("personality", "swag")
    conversation_id = data.get("conversation_id")
    if not conversation_id:
        conversation_id = str(uuid.uuid4())

    if not message:
        return JSONResponse(
            content={"message": "Message is required", "conversation_id": conversation_id},
            status_code=400,
            headers=cors_headers,
        )

    logger.info(f"Stream chat request - User: {current_user.get('uid')}, Conversation: {conversation_id}, Personality: {personality}")

    async def event_generator():
        sentence_boundary = re.compile(r'(?<=[.!?])\s+')
        buffer = ""
        full_response = ""
        user_id = None
        profile_id = None

        try:
            messages, user_id, profile_id = await _build_chat_messages(message, personality, conversation_id, current_user)

            async for delta in get_groq_response_stream(messages):
                buffer += delta
                parts = sentence_boundary.split(buffer)
                # Keep the last (possibly incomplete) fragment in the buffer;
                # flush every complete sentence before it.
                buffer = parts[-1]
                for sentence in parts[:-1]:
                    cleaned = _clean_response_sentence(sentence, message, personality)
                    if cleaned:
                        full_response += cleaned + " "
                        yield f"data: {json.dumps({'text': cleaned + ' '})}\n\n"

            # Flush whatever's left (text that never hit a sentence boundary)
            if buffer.strip():
                cleaned = _clean_response_sentence(buffer, message, personality)
                if cleaned:
                    full_response += cleaned
                    yield f"data: {json.dumps({'text': cleaned})}\n\n"

        except Exception as e:
            logger.error(f"Error in /chat/stream generator: {str(e)}")
            logger.error(traceback.format_exc())
            if not full_response.strip():
                fallback = "Hmm, let me think of a better response. Try asking me something else!"
                full_response = fallback
                yield f"data: {json.dumps({'text': fallback})}\n\n"

        full_response = full_response.strip() or "Sorry, the AI could not generate a response."

        # Store the conversation + refresh compressed memory, same as /chat —
        # needs the full accumulated text, so this runs after the stream ends.
        final_conversation_id = conversation_id
        if user_id and profile_id:
            try:
                final_conversation_id = await store_message(
                    user_id=user_id,
                    profile_id=profile_id,
                    personality=personality,
                    message=message,
                    response=full_response,
                    chat_id=conversation_id
                )
            except Exception as e:
                logger.error(f"Error storing streamed message in Firestore: {str(e)}")

            try:
                from firebase_memory_manager import get_chat_messages, store_compressed_memory
                from groq_memory import summarize_chat_memory
                last_100_msgs = await get_chat_messages(
                    chat_id=final_conversation_id, user_id=user_id, profile_id=profile_id, limit=100
                )
                last_100_msgs.reverse()
                formatted_msgs = []
                for msg in last_100_msgs:
                    if msg.get('message'):
                        formatted_msgs.append({"role": "user", "content": msg['message']})
                    if msg.get('response'):
                        formatted_msgs.append({"role": "assistant", "content": msg['response']})
                compressed_memory = await summarize_chat_memory(formatted_msgs)
                await store_compressed_memory(final_conversation_id, user_id, profile_id, compressed_memory)
            except Exception as e:
                logger.warning(f"Failed to summarize and store compressed memory (stream): {str(e)}")

        yield f"data: {json.dumps({'done': True, 'conversation_id': final_conversation_id})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            **cors_headers,
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


def _clean_response_sentence(sentence: str, user_message: str, personality: str) -> str:
    """
    Runs one completed sentence through the same anti-leakage/cleanup
    pipeline /chat applies to its full response. Token-level streaming isn't
    safe here — the meta-leak regex needs complete sentences to match
    correctly — so sentence-level is the smallest safe granularity.
    """
    text = sentence.strip()
    if not text:
        return ""

    text = remove_user_message_references(text, user_message)
    persona_name = get_persona_name(personality)
    if text.lower().startswith(persona_name.lower() + ":"):
        text = text[len(persona_name) + 1:].strip()
    text = remove_meta_references(text)

    forbidden_keywords = ["mistral ai", "mistral", "Mistral AI", "Mistral"]
    for keyword in forbidden_keywords:
        text = text.replace(keyword, "AI")

    meta_leak_phrases = [
        "system log", "prompt", "private LLM", "I'm just a computer program", "as an AI", "as an LLM", "I am an AI", "I am an LLM",
        "I'm running on", "I will never share my system log", "instructions", "meta", "I don't have feelings", "I don't have a body",
        "I'm here to help you with any questions or information you need."
    ]
    for phrase in meta_leak_phrases:
        if phrase.lower() in text.lower():
            text = re.sub(r'[^.]*' + re.escape(phrase) + r'[^.]*[.!?]', '', text, flags=re.IGNORECASE)

    return text.strip()


@api_app.put("/conversations/{conversation_id}")
async def update_conversation(conversation_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    """Update a conversation's metadata (title, personality, etc.) in Firestore."""
    try:
        data = await request.json()
        title = data.get("title")
        personality = data.get("personality")
        
        if not any([title, personality]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one field (title or personality) is required"
            )
        
        # Get user ID and profile ID from the authenticated user
        user_id = current_user.get("uid")
        profile_id = current_user.get("profile_id")
        
        # Prepare update data
        update_data = {
            'updated_at': firestore.SERVER_TIMESTAMP
        }
        if title is not None:
            update_data['title'] = title
        if personality is not None:
            update_data['personality'] = personality
        
        # Update the conversation in Firestore
        db = firestore.client()
        conversation_ref = db.collection('users').document(profile_id or user_id)\
                             .collection('conversations').document(conversation_id)
        
        # Check if the conversation exists and belongs to the user
        conversation = await conversation_ref.get()
        if not conversation.exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found"
            )
            
        await conversation_ref.update(update_data)
        
        # Get the updated conversation
        updated_conversation = await conversation_ref.get()
        
        return {
            "success": True,
            "conversation": {
                "id": conversation_id,
                "title": updated_conversation.get("title"),
                "personality": updated_conversation.get("personality"),
                "profile_id": profile_id,
                "user_id": user_id,
                "updated_at": updated_conversation.get("updated_at").isoformat() if updated_conversation.get("updated_at") else None
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating conversation: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update conversation"
        )

@api_app.get("/conversations")
async def get_conversations_endpoint(current_user: dict = Depends(get_current_user)):
    """Get the user's conversations from Firestore."""
    try:
        # Get user ID and profile ID from the authenticated user
        user_id = current_user.get("uid")
        profile_id = current_user.get("profile_id")
        
        # Fetch conversations from Firestore
        conversations = await get_chat_history(user_id, profile_id)
        
        return {
            "success": True,
            "conversations": conversations
        }
    except Exception as e:
        logger.error(f"Error fetching conversations: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch conversations"
        )

@api_app.delete("/conversations/{conversation_id}")
async def delete_conversation_endpoint(conversation_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a conversation and all its messages from Firestore."""
    try:
        # Get user ID and profile ID from the authenticated user
        user_id = current_user.get("uid")
        profile_id = current_user.get("profile_id")
        
        # Delete the conversation and its messages
        success = await delete_chat(conversation_id, user_id, profile_id)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found or could not be deleted"
            )
            
        return {
            "success": True,
            "message": "Conversation deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting conversation: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete conversation"
        )

from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi import status as fastapi_status

@api_app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(f"Request validation error: {exc.errors()}")
    # Always return a valid conversation_id, even on validation errors
    return JSONResponse(
        status_code=fastapi_status.HTTP_400_BAD_REQUEST,
        content=ChatResponse(
            message="Invalid request. Please check the data you sent.",
            timestamp=datetime.now().isoformat(),
            personality="swag",  # Default personality for validation errors
            conversation_id=str(uuid.uuid4()) # Generate a new UUID
        ).dict()
    )

# Mount the API under /api so routes match what the frontend calls
# (e.g. /api/chat, /api/mistral-heading), and the whole app deploys
# cleanly as a single Vercel serverless function.
app = FastAPI()
app.mount("/api", api_app)

# To run the server manually:
# uvicorn main:app --host 0.0.0.0 --port 8000 --reload
# Or use: python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
