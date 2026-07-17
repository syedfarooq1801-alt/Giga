import * as Crypto from 'expo-crypto';

/**
 * Generates a new random UUID v4
 * @param context Context for logging
 * @returns A new UUID v4 string
 */
export const generateUUID = (context: string = 'unknown'): string => {
  const newId = Crypto.randomUUID();
  console.log(`[${context}] Generated new UUID: ${newId}`);
  return newId;
};

/**
 * Checks if a string is a valid UUID v4
 * @param id The string to check
 * @returns True if the string is a valid UUID v4
 */
export const isValidUUID = (id?: string): boolean => {
  if (!id) return false;
  try {
    // UUID v4 regex pattern
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidPattern.test(id);
  } catch {
    return false;
  }
};

/**
 * Ensures that the provided ID is a valid UUID v4
 * If the ID is already a valid UUID v4, it returns it
 * Otherwise, it generates a new UUID v4
 * 
 * @param id The string to validate
 * @param context Context for logging
 * @returns A valid UUID v4 string
 */
export const ensureUUID = (id?: string, context: string = 'unknown'): string => {
  if (!id) {
    return generateUUID(`${context}_ensureUUID_empty`);
  }
  
  if (isValidUUID(id)) {
    console.log(`[${context}] Using existing valid UUID: ${id}`);
    return id;
  }
  
  return generateUUID(`${context}_ensureUUID_invalid`);
};

/**
 * Converts a timestamp or other string to a UUID-compatible format
 * This is useful when you want to maintain some relationship to the original ID
 * but need to ensure it's in UUID format
 * 
 * @param value The value to convert to a UUID-compatible format
 * @returns A valid UUID string
 */
export const valueToUUID = (value: string | number): string => {
  // Convert the value to a string
  const valueStr = String(value);
  
  // Use the value as a namespace with a consistent name to generate a UUID v5
  // This will always generate the same UUID for the same input value
  const namespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // A predefined namespace UUID
  
  // Since we don't have direct access to uuid.v5, we'll use v4 and add a comment
  // In a real implementation, you would use:
  // return uuid.v5(valueStr, namespace);
  
  // For now, we'll use v4 but note that this won't preserve the relationship
  console.warn('Using random UUID instead of deterministic UUID. Consider using uuid.v5 for consistent mapping.');
  return generateUUID();
};
