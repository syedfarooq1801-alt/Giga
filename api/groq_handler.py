import httpx
import asyncio
import json
import time
import logging
from typing import AsyncGenerator
from config import GROQ_API_KEY, GROQ_API_URL

async def get_groq_response(messages: list):
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    
    # Prepare the final messages list
    final_messages = []
    
    # Add system messages if any
    system_messages = [msg for msg in messages if msg.get('role') == 'system']
    if system_messages:
        system_content = "\n".join([msg.get('content', '') for msg in system_messages if msg.get('content')])
        final_messages.append({"role": "system", "content": system_content})
    
    # Add conversation messages
    conversation_messages = [msg for msg in messages if msg.get('role') != 'system']
    final_messages.extend(conversation_messages)
    
    # Prepare the payload for Groq with more conservative token limits
    # Calculate max tokens based on input length (leaving room for response)
    # Rough estimate: 4 chars ≈ 1 token, but be conservative
    input_text = ' '.join([msg.get('content', '') for msg in final_messages])
    estimated_input_tokens = len(input_text) // 2  # Conservative estimate
    
    # Set max_tokens to leave enough room for the response
    # For llama3-70b-8192, we'll keep a safe margin
    max_allowed_tokens = 8000  # Leave some room for safety
    max_tokens = min(2048, max(100, max_allowed_tokens - estimated_input_tokens))
    
    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": final_messages,
        "temperature": 0.7,
        "max_tokens": max_tokens,
        "top_p": 0.9,
        "frequency_penalty": 0.5,
        "presence_penalty": 0.5
    }
    
    max_retries = 3
    delay = 0.5  # seconds
    max_total_time = 25.0  # seconds
    start_time = time.monotonic()
    logger = logging.getLogger("groq_handler")
    
    for attempt in range(max_retries):
        try:
            # If we've spent too long, abort
            if time.monotonic() - start_time > max_total_time:
                return "Sorry, the AI is taking too long to respond. Please try again later."
                
            call_start = time.monotonic()
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(GROQ_API_URL, headers=headers, json=payload)
                
            call_duration = time.monotonic() - call_start
            logger.info(f"Groq API call took {call_duration:.2f} seconds (attempt {attempt+1})")
            
            # Check for error responses
            if response.status_code == 429:
                if attempt < max_retries - 1 and (time.monotonic() - start_time + delay) < max_total_time:
                    await asyncio.sleep(delay)
                    delay = min(delay * 2, max_total_time - (time.monotonic() - start_time))
                    continue
                return "Rate limit exceeded. Please try again in a few seconds."
                
            elif response.status_code != 200:
                error_msg = response.text
                logger.error(f"Groq API error {response.status_code}: {error_msg}")
                return f"Error from Groq API: {error_msg}"
            
            # Parse successful response
            response_json = response.json()
            if 'choices' in response_json and len(response_json['choices']) > 0:
                message = response_json['choices'][0].get('message', {})
                if message.get('role') == 'assistant':
                    return message.get('content', '')
                return message.get('content', '') if message else ''
                
            return ""
            
        except asyncio.TimeoutError:
            if attempt == max_retries - 1:
                return "Request timed out. Please try again."
            await asyncio.sleep(delay)
            delay = min(delay * 2, 5.0)  # Cap the delay at 5 seconds
            
        except Exception as e:
            logger.error(f"Error in get_groq_response: {str(e)}", exc_info=True)
            if attempt == max_retries - 1:
                return f"An error occurred: {str(e)}"
            await asyncio.sleep(delay)
            delay = min(delay * 2, 5.0)  # Cap the delay at 5 seconds


VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"


async def get_groq_vision_response(system_prompt: str, text: str, image_data_url: str) -> str:
    """Single-turn multi-modal call for image messages -- deliberately NOT
    routed through the normal history-building path (_build_chat_messages
    assumes plain string content everywhere); an image turn is its own
    persona-voiced one-shot exchange, consistent with how regenerate/RAG
    are also non-streaming, standalone code paths rather than woven into
    the main conversation-history machinery.
    """
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": VISION_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": text or "What's in this image?"},
                    {"type": "image_url", "image_url": {"url": image_data_url}},
                ],
            },
        ],
        "temperature": 0.7,
        "max_tokens": 500,
    }

    logger = logging.getLogger("groq_handler")
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(GROQ_API_URL, headers=headers, json=payload)
        if response.status_code != 200:
            logger.error(f"Groq vision API error {response.status_code}: {response.text}")
            return "Hmm, couldn't look at that image properly. Try again?"
        data = response.json()
        return data["choices"][0]["message"].get("content", "") or ""
    except Exception as e:
        logger.error(f"Error in get_groq_vision_response: {str(e)}", exc_info=True)
        return "Hmm, couldn't look at that image properly. Try again?"


async def get_groq_response_stream(messages: list) -> AsyncGenerator[str, None]:
    """
    Sibling to get_groq_response() that yields content deltas as they arrive
    from Groq's SSE stream, instead of waiting for one complete response.
    Kept separate (rather than adding a stream=True branch to the function
    above) so /mistral-heading and /groq-heading keep using the proven
    non-streaming path unchanged.
    """
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }

    final_messages = []
    system_messages = [msg for msg in messages if msg.get('role') == 'system']
    if system_messages:
        system_content = "\n".join([msg.get('content', '') for msg in system_messages if msg.get('content')])
        final_messages.append({"role": "system", "content": system_content})
    conversation_messages = [msg for msg in messages if msg.get('role') != 'system']
    final_messages.extend(conversation_messages)

    input_text = ' '.join([msg.get('content', '') for msg in final_messages])
    estimated_input_tokens = len(input_text) // 2
    max_allowed_tokens = 8000
    max_tokens = min(2048, max(100, max_allowed_tokens - estimated_input_tokens))

    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": final_messages,
        "temperature": 0.7,
        "max_tokens": max_tokens,
        "top_p": 0.9,
        "frequency_penalty": 0.5,
        "presence_penalty": 0.5,
        "stream": True,
    }

    logger = logging.getLogger("groq_handler")

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            async with client.stream("POST", GROQ_API_URL, headers=headers, json=payload) as response:
                if response.status_code != 200:
                    error_body = await response.aread()
                    logger.error(f"Groq stream API error {response.status_code}: {error_body!r}")
                    return
                async for line in response.aiter_lines():
                    if not line or not line.startswith("data: "):
                        continue
                    data = line[len("data: "):].strip()
                    if data == "[DONE]":
                        return
                    try:
                        chunk = json.loads(data)
                    except json.JSONDecodeError:
                        continue
                    choices = chunk.get("choices") or []
                    if not choices:
                        continue
                    delta = choices[0].get("delta", {})
                    content = delta.get("content", "")
                    if content:
                        yield content
    except Exception as e:
        logger.error(f"Error in get_groq_response_stream: {str(e)}", exc_info=True)
        return
