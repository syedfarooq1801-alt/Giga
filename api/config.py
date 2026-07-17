import os
from dotenv import load_dotenv

load_dotenv()

# Groq AI Configuration
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

# Environment Configuration
ENVIRONMENT = os.getenv('ENVIRONMENT', 'development')

# Supabase Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "your-supabase-jwt-secret") # Add this to your .env file

# Legacy Firebase Configuration (kept for backward compatibility during migration)
FIREBASE_API_KEY = os.getenv("FIREBASE_API_KEY")
FIREBASE_AUTH_DOMAIN = os.getenv("FIREBASE_AUTH_DOMAIN")
FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID")
FIREBASE_STORAGE_BUCKET = os.getenv("FIREBASE_STORAGE_BUCKET")
FIREBASE_MESSAGING_SENDER_ID = os.getenv("FIREBASE_MESSAGING_SENDER_ID")
FIREBASE_APP_ID = os.getenv("FIREBASE_APP_ID")

# Application Configuration
# Serverless hosts (Vercel etc.) only allow writes under /tmp; everywhere else
# is read-only at runtime, so these must not point into the deployed source tree.
_writable_root = "/tmp" if os.getenv("VERCEL") else os.path.dirname(__file__)
UPLOAD_DIR = os.path.join(_writable_root, "uploads")
MODELS_DIR = os.path.join(_writable_root, "models")

# Create necessary directories (best-effort — a read-only filesystem shouldn't crash startup)
try:
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    os.makedirs(MODELS_DIR, exist_ok=True)
except OSError:
    pass
