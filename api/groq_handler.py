import httpx
import asyncio
import time
import logging
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
