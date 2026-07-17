import os
import json
import logging
import secrets
import uuid
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
from firebase_admin import firestore, auth
import firebase_admin
from firebase_admin import credentials
from personalities import assign_variant

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Initialize Firestore
db = firestore.client()

async def store_compressed_memory(chat_id: str, user_id: str, profile_id: str, compressed_memory: list):
    """
    Store compressed (summarized) chat memory for a conversation under a summary index per user.
    """
    try:
        effective_user_id = profile_id or user_id
        summary_ref = db.collection('users').document(effective_user_id).collection('summary').document(chat_id)
        summary_ref.set({'compressed_memory': compressed_memory})
        return True
    except Exception as e:
        logger.error(f"Error storing compressed memory: {str(e)}")
        return False

async def get_compressed_memory(chat_id: str, user_id: str, profile_id: str):
    """
    Retrieve compressed (summarized) chat memory for a conversation from the summary index per user.
    """
    try:
        effective_user_id = profile_id or user_id
        summary_ref = db.collection('users').document(effective_user_id).collection('summary').document(chat_id)
        summary_doc = summary_ref.get()
        if summary_doc.exists:
            return summary_doc.to_dict().get('compressed_memory', [])
        return []
    except Exception as e:
        logger.error(f"Error retrieving compressed memory: {str(e)}")
        return []

async def store_message(
    user_id: str,
    profile_id: str = None,
    personality: str = "swag",
    message: str = None,
    response: str = None,
    chat_id: str = None
) -> Tuple[str, str]:
    """Store a message in Firestore

    Args:
        user_id: The user ID from Firebase Auth
        profile_id: The profile ID for data isolation
        personality: The personality used for the response
        message: The user message
        response: The AI response
        chat_id: The chat ID (optional, will create new if not provided)

    Returns:
        Tuple of (chat_id, message_doc_id)
    """
    try:
        logger.info(f"Storing message for user_id: {user_id}, profile_id: {profile_id}")
        
        # Use profile_id for data isolation if available, otherwise use user_id
        effective_user_id = profile_id or user_id
        
        # Create a new chat if no chat_id provided
        if not chat_id:
            chat_ref = db.collection('users').document(effective_user_id).collection('chats').document()
            # .document() generates its id client-side immediately, so it's
            # available for the variant hash before .set() ever hits the network.
            new_chat_id = chat_ref.id
            chat_data = {
                'created_at': firestore.SERVER_TIMESTAMP,
                'updated_at': firestore.SERVER_TIMESTAMP,
                'personality': personality,
                'title': f"Chat {datetime.now().strftime('%Y-%m-%d %H:%M')}",
                'prompt_variant': assign_variant(personality, new_chat_id),
            }
            chat_ref.set(chat_data)
            chat_id = new_chat_id
        else:
            chat_ref = db.collection('users').document(effective_user_id).collection('chats').document(chat_id)
            chat_doc = chat_ref.get() # Attempt to get the document
            if not chat_doc.exists:
                # Document doesn't exist, create it
                logger.info(f"Chat document {chat_id} not found for profile {effective_user_id}. Creating new one.")
                chat_data = {
                    'created_at': firestore.SERVER_TIMESTAMP,
                    'updated_at': firestore.SERVER_TIMESTAMP,
                    'personality': personality,  # Use current message's personality
                    'title': f"Continuation of chat {datetime.now().strftime('%Y-%m-%d %H:%M')}", # Default title
                    'prompt_variant': assign_variant(personality, chat_id),
                }
                chat_ref.set(chat_data) # Set will create the document if it doesn't exist
            else:
                # Document exists, update its timestamp
                chat_ref.update({'updated_at': firestore.SERVER_TIMESTAMP})
        
        # Add the message to the chat
        message_ref = chat_ref.collection('messages').document()
        message_data = {
            'user_id': user_id,
            'profile_id': profile_id,
            'personality': personality,
            'message': message,
            'response': response,
            'timestamp': firestore.SERVER_TIMESTAMP
        }
        message_ref.set(message_data)

        return chat_id, message_ref.id

    except Exception as e:
        logger.error(f"Error storing message in Firestore: {str(e)}")
        raise

async def get_chat_history(user_id: str, profile_id: str = None, limit: int = 50) -> List[Dict[str, Any]]:
    """Get chat history for a user from Firestore
    
    Args:
        user_id: The user ID from Firebase Auth
        profile_id: The profile ID for data isolation
        limit: Maximum number of messages to return
        
    Returns:
        List of chat messages with metadata
    """
    try:
        logger.info(f"Getting chat history for user_id: {user_id}, profile_id: {profile_id}")
        
        # Use profile_id for data isolation if available
        effective_user_id = profile_id or user_id
        
        # Get all chats for the user, ordered by most recent
        chats_ref = db.collection('users').document(effective_user_id).collection('chats')
        chats = chats_ref.order_by('updated_at', direction='DESCENDING').stream()
        
        result = []
        for chat in chats:
            chat_data = chat.to_dict()
            chat_data['id'] = chat.id
            
            # Get the most recent message for each chat
            messages_ref = chat.reference.collection('messages')
            messages = messages_ref.order_by('timestamp', direction='DESCENDING').limit(1).stream()
            
            for message in messages:
                message_data = message.to_dict()
                chat_data['last_message'] = message_data.get('message', '')
                chat_data['last_message_time'] = message_data.get('timestamp')
                break
                
            result.append(chat_data)
            
            # Apply limit
            if len(result) >= limit:
                break
                
        return result
        
    except Exception as e:
        logger.error(f"Error getting chat history from Firestore: {str(e)}")
        raise

async def get_chat_messages(chat_id: str, user_id: str, profile_id: str = None, limit: int = 100) -> List[Dict[str, Any]]:
    """Get messages for a specific chat
    
    Args:
        chat_id: The chat ID
        user_id: The user ID from Firebase Auth
        profile_id: The profile ID for data isolation
        limit: Maximum number of messages to return
        
    Returns:
        List of messages in the chat
    """
    try:
        effective_user_id = profile_id or user_id
        messages_ref = (
            db.collection('users')
            .document(effective_user_id)
            .collection('chats')
            .document(chat_id)
            .collection('messages')
            .order_by('timestamp', direction='DESCENDING')
            .limit(limit)
        )
        
        messages = messages_ref.get()
        return [{
            'id': msg.id,
            **msg.to_dict(),
            'timestamp': msg.to_dict().get('timestamp').isoformat() if msg.to_dict().get('timestamp') else None
        } for msg in messages]
        
    except Exception as e:
        logger.error(f"Error getting chat messages from Firestore: {str(e)}")
        raise

async def update_chat_title(
    chat_id: str, user_id: str, title: str = None, profile_id: str = None, personality: str = None
) -> bool:
    """Update a chat's title and/or personality

    Args:
        chat_id: The chat ID
        user_id: The user ID from Firebase Auth
        title: The new title (optional)
        profile_id: The profile ID for data isolation
        personality: The new default personality for this chat (optional)

    Returns:
        bool: True if successful
    """
    try:
        effective_user_id = profile_id or user_id
        update_data = {'updated_at': firestore.SERVER_TIMESTAMP}
        if title is not None:
            update_data['title'] = title
        if personality is not None:
            update_data['personality'] = personality
        (
            db.collection('users')
            .document(effective_user_id)
            .collection('chats')
            .document(chat_id)
            .update(update_data)
        )
        return True
    except Exception as e:
        logger.error(f"Error updating chat title in Firestore: {str(e)}")
        return False


async def update_message_response(
    chat_id: str, message_doc_id: str, user_id: str, profile_id: str, new_response: str
) -> bool:
    """Overwrite an existing turn's 'response' field in place (regenerate),
    instead of store_message's always-new-doc behavior."""
    try:
        effective_user_id = profile_id or user_id
        msg_ref = (
            db.collection('users').document(effective_user_id)
            .collection('chats').document(chat_id)
            .collection('messages').document(message_doc_id)
        )
        doc = msg_ref.get()
        if not doc.exists:
            return False
        msg_ref.update({'response': new_response, 'timestamp': firestore.SERVER_TIMESTAMP})
        return True
    except Exception as e:
        logger.error(f"Error updating message response: {str(e)}")
        return False


async def set_message_reaction(
    chat_id: str, message_doc_id: str, user_id: str, profile_id: str, thumbs_up: bool, thumbs_down: bool
) -> bool:
    """Set (or clear, by passing both False) a thumbs up/down reaction on a message."""
    try:
        effective_user_id = profile_id or user_id
        msg_ref = (
            db.collection('users').document(effective_user_id)
            .collection('chats').document(chat_id)
            .collection('messages').document(message_doc_id)
        )
        doc = msg_ref.get()
        if not doc.exists:
            return False
        msg_ref.update({'reactions': {'thumbsUp': thumbs_up, 'thumbsDown': thumbs_down}})
        return True
    except Exception as e:
        logger.error(f"Error setting message reaction: {str(e)}")
        return False


async def create_share_token(chat_id: str, owner_uid: str, profile_id: str) -> str:
    """Mint a public, read-only share token referencing a conversation.
    Stores a reference (owner_uid/profile_id/chat_id), not a denormalized
    copy: simpler, always reflects current state. If the owner later
    deletes the underlying chat, the share link starts 404ing (treated as
    equivalent to revoked) rather than serving stale content."""
    token = secrets.token_urlsafe(16)
    db.collection('shared_conversations').document(token).set({
        'owner_uid': owner_uid,
        'profile_id': profile_id,
        'chat_id': chat_id,
        'created_at': firestore.SERVER_TIMESTAMP,
        'revoked': False,
    })
    return token


async def get_share(token: str) -> Optional[Dict[str, Any]]:
    """Look up a share token's reference doc, or None if it doesn't exist."""
    doc = db.collection('shared_conversations').document(token).get()
    return doc.to_dict() if doc.exists else None


async def revoke_share(token: str, owner_uid: str) -> bool:
    """Revoke a share token. Only the owner who minted it may revoke it."""
    try:
        ref = db.collection('shared_conversations').document(token)
        doc = ref.get()
        if not doc.exists or doc.to_dict().get('owner_uid') != owner_uid:
            return False
        ref.update({'revoked': True})
        return True
    except Exception as e:
        logger.error(f"Error revoking share: {str(e)}")
        return False

async def get_experiment_results(persona_id: str) -> Dict[str, Any]:
    """Aggregate message counts and thumbsUp/thumbsDown reactions per
    prompt_variant for a persona, across all users -- powers the A/B
    experiment results endpoint.

    Each Firestore message doc is one full turn (user message + assistant
    response + optional reactions on that response), so "messages" here is
    a turn count and thumbs counts reflect reactions on that turn's
    response. Requires a Firestore collection-group index on
    messages.personality -- the console supplies the exact creation link on
    the first FailedPrecondition error if it doesn't exist yet.
    """
    try:
        variant_cache: Dict[str, str] = {}
        stats: Dict[str, Dict[str, int]] = {}

        docs = db.collection_group('messages').where('personality', '==', persona_id).stream()
        for doc in docs:
            data = doc.to_dict()
            chat_ref = doc.reference.parent.parent
            if chat_ref is None:
                continue
            chat_id = chat_ref.id
            if chat_id not in variant_cache:
                chat_doc = chat_ref.get()
                chat_data = chat_doc.to_dict() if chat_doc.exists else {}
                # Falls back to recomputing the hash for any chat created
                # before prompt_variant existed on the chat doc.
                variant_cache[chat_id] = chat_data.get('prompt_variant') or assign_variant(persona_id, chat_id)
            variant = variant_cache[chat_id]

            bucket = stats.setdefault(variant, {'messages': 0, 'thumbs_up': 0, 'thumbs_down': 0})
            bucket['messages'] += 1
            reactions = data.get('reactions') or {}
            if reactions.get('thumbsUp'):
                bucket['thumbs_up'] += 1
            if reactions.get('thumbsDown'):
                bucket['thumbs_down'] += 1

        return stats
    except Exception as e:
        logger.error(f"Error aggregating experiment results: {str(e)}")
        raise


async def add_document_metadata(profile_id: str, user_id: str, doc_id: str, filename: str, chunk_count: int) -> None:
    """Firestore is the system-of-record for "what did this user upload" --
    Qdrant only holds the vectors, it's not a good place to list/manage
    documents from."""
    effective_user_id = profile_id or user_id
    db.collection('users').document(effective_user_id).collection('documents').document(doc_id).set({
        'filename': filename,
        'chunk_count': chunk_count,
        'uploaded_at': firestore.SERVER_TIMESTAMP,
    })


async def list_documents(profile_id: str, user_id: str) -> List[Dict[str, Any]]:
    effective_user_id = profile_id or user_id
    docs = (
        db.collection('users').document(effective_user_id).collection('documents')
        .order_by('uploaded_at', direction=firestore.Query.DESCENDING)
        .stream()
    )
    return [{'doc_id': d.id, **d.to_dict()} for d in docs]


async def delete_document_metadata(profile_id: str, user_id: str, doc_id: str) -> bool:
    effective_user_id = profile_id or user_id
    ref = db.collection('users').document(effective_user_id).collection('documents').document(doc_id)
    if not ref.get().exists:
        return False
    ref.delete()
    return True


async def fork_conversation(
    source_chat_id: str, source_owner_uid: str, source_profile_id: Optional[str],
    dest_user_id: str, dest_profile_id: Optional[str]
) -> Tuple[str, str]:
    """Copy a conversation's full turn history into a NEW chat under a
    different user's account -- used by the shared-chat "Continue this
    chat" flow, so a viewer can keep chatting without writing into the
    original owner's data. The new chat's updated_at is "now", so it's
    naturally the destination user's most-recent conversation afterward.

    Returns (new_chat_id, title).
    """
    try:
        source_effective_id = source_profile_id or source_owner_uid
        source_chat_ref = (
            db.collection('users').document(source_effective_id)
            .collection('chats').document(source_chat_id)
        )
        source_chat_doc = source_chat_ref.get()
        source_data = source_chat_doc.to_dict() if source_chat_doc.exists else {}
        original_title = source_data.get('title', 'Shared chat')
        personality = source_data.get('personality', 'swag')

        turns = [
            t.to_dict() for t in
            source_chat_ref.collection('messages').order_by('timestamp', direction=firestore.Query.ASCENDING).stream()
        ]

        dest_effective_id = dest_profile_id or dest_user_id
        new_chat_ref = db.collection('users').document(dest_effective_id).collection('chats').document()
        title = f"{original_title} (continued)"
        new_chat_ref.set({
            'created_at': firestore.SERVER_TIMESTAMP,
            'updated_at': firestore.SERVER_TIMESTAMP,
            'personality': personality,
            'title': title,
        })

        batch = db.batch()
        for turn in turns:
            msg_ref = new_chat_ref.collection('messages').document()
            batch.set(msg_ref, {
                'user_id': dest_user_id,
                'profile_id': dest_profile_id,
                'personality': turn.get('personality', personality),
                'message': turn.get('message'),
                'response': turn.get('response'),
                'timestamp': turn.get('timestamp') or firestore.SERVER_TIMESTAMP,
            })
        batch.commit()

        return new_chat_ref.id, title
    except Exception as e:
        logger.error(f"Error forking conversation: {str(e)}")
        raise


async def delete_chat(chat_id: str, user_id: str, profile_id: str = None) -> bool:
    """Delete a chat and all its messages
    
    Args:
        chat_id: The chat ID
        user_id: The user ID from Firebase Auth
        profile_id: The profile ID for data isolation
        
    Returns:
        bool: True if successful
    """
    try:
        effective_user_id = profile_id or user_id
        chat_ref = (
            db.collection('users')
            .document(effective_user_id)
            .collection('chats')
            .document(chat_id)
        )
        
        # Delete all messages in the chat first
        messages_ref = chat_ref.collection('messages')
        messages = messages_ref.stream()
        
        batch = db.batch()
        for message in messages:
            batch.delete(message.reference)
        
        # Delete the chat document
        batch.delete(chat_ref)
        batch.commit()
        
        return True
    except Exception as e:
        logger.error(f"Error deleting chat from Firestore: {str(e)}")
        return False
