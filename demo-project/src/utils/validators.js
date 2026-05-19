/**
 * Input Validation Utilities
 * Pure functions for validating user-supplied data before processing.
 */

/**
 * Validates an email address format.
 *
 * @param {string} email
 * @returns {boolean}
 */
function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validates a password meets minimum requirements.
 * Requirements: at least 8 characters.
 *
 * @param {string} password
 * @returns {boolean}
 */
function validatePassword(password) {
  if (!password || typeof password !== 'string') return false;
  return password.length >= 8;
}

/**
 * Validates a UUID v4 string.
 *
 * @param {string} id
 * @returns {boolean}
 */
function validateUUID(id) {
  if (!id || typeof id !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Validates a phone number in E.164 format or common national formats.
 * Accepts optional leading +, country code, and 7–15 digits (per ITU-T E.164).
 *
 * @param {string} phone
 * @returns {boolean}
 */
function validatePhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return false;
  const phoneRegex = /^\+?[1-9]\d{6,14}$/;
  return phoneRegex.test(phone.trim().replace(/[\s\-().]/g, ''));
}

/**
 * Validates password strength.
 * Requirements: minimum 10 characters, at least one uppercase letter,
 * one lowercase letter, one digit, and one special character.
 *
 * @param {string} password
 * @returns {boolean}
 */
function validatePasswordStrength(password) {
  if (!password || typeof password !== 'string') return false;
  if (password.length < 10) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  if (!/[^A-Za-z0-9]/.test(password)) return false;
  return true;
}

/**
 * Sanitizes a string by trimming whitespace and removing control characters.
 *
 * @param {string} input
 * @returns {string}
 */
function sanitizeString(input) {
  if (!input || typeof input !== 'string') return '';
  return input.trim().replace(/[\x00-\x1F\x7F]/g, '');
}

module.exports = {
  validateEmail,
  validatePassword,
  validatePasswordStrength,
  validateUUID,
  validatePhoneNumber,
  sanitizeString
};
