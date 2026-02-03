/**
 * Validation utilities
 */

function validateTrackingPayload(payload) {
  // Check if payload is array or object
  const items = Array.isArray(payload) ? payload : [payload];

  if (!Array.isArray(items) || items.length === 0) {
    return {
      valid: false,
      error: 'Payload must be an object or non-empty array'
    };
  }

  // Validate each item
  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    // Required fields
    if (!item.method) {
      return {
        valid: false,
        error: `Item ${i}: Missing required field 'method'`
      };
    }

    if (!item.route) {
      return {
        valid: false,
        error: `Item ${i}: Missing required field 'route'`
      };
    }

    if (item.statusCode === undefined || item.statusCode === null) {
      return {
        valid: false,
        error: `Item ${i}: Missing required field 'statusCode'`
      };
    }

    // Type validation
    if (typeof item.method !== 'string') {
      return {
        valid: false,
        error: `Item ${i}: 'method' must be a string`
      };
    }

    if (typeof item.route !== 'string') {
      return {
        valid: false,
        error: `Item ${i}: 'route' must be a string`
      };
    }

    if (typeof item.statusCode !== 'number') {
      return {
        valid: false,
        error: `Item ${i}: 'statusCode' must be a number`
      };
    }

    // Valid HTTP methods
    const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
    if (!validMethods.includes(item.method.toUpperCase())) {
      return {
        valid: false,
        error: `Item ${i}: Invalid HTTP method '${item.method}'`
      };
    }

    // Status code range
    if (item.statusCode < 100 || item.statusCode > 599) {
      return {
        valid: false,
        error: `Item ${i}: 'statusCode' must be between 100 and 599`
      };
    }

    // Optional fields validation
    if (item.timestamp && !isValidISODate(item.timestamp)) {
      return {
        valid: false,
        error: `Item ${i}: Invalid 'timestamp' format (must be ISO 8601)`
      };
    }

    if (item.latency !== undefined && typeof item.latency !== 'number') {
      return {
        valid: false,
        error: `Item ${i}: 'latency' must be a number`
      };
    }
  }

  return { valid: true };
}

function isValidISODate(dateString) {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
}

function validatePassword(password) {
  if (typeof password !== 'string') {
    return { valid: false, error: 'Password must be a string' };
  }

  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }

  if (password.length > 128) {
    return { valid: false, error: 'Password is too long' };
  }

  // Check for at least one uppercase, one lowercase, one number
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter' };
  }

  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one lowercase letter' };
  }

  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number' };
  }

  return { valid: true };
}

module.exports = {
  validateTrackingPayload,
  isValidISODate,
  validatePassword
};
