// server/utils/privacy.js
const crypto = require('crypto');

// Hash phone number for anonymization
function hashPhoneNumber(phoneNumber) {
  // Remove any formatting characters
  const cleanNumber = phoneNumber.replace(/\D/g, '');
  
  // Create SHA-256 hash
  return crypto
    .createHash('sha256')
    .update(cleanNumber + process.env.WEBHOOK_SECRET) // Add salt
    .digest('hex');
}

// Anonymize conversation data before storage
function anonymizeConversation(conversation) {
  return {
    ...conversation,
    userMessage: conversation.userMessage ? '[REDACTED]' : null,
    botResponse: conversation.botResponse ? '[REDACTED]' : null,
    // Keep only metadata
    messageLength: conversation.userMessage?.length || 0,
    responseLength: conversation.botResponse?.length || 0
  };
}

// Check if data contains PII (Personal Identifiable Information)
function containsPII(text) {
  const piiPatterns = [
    /\b\d{11}\b/, // Nigerian phone numbers
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i, // Email addresses
    /\b\d{11,16}\b/, // Credit card numbers
    /\b\d{3}-\d{2}-\d{4}\b/ // SSN-like patterns
  ];
  
  return piiPatterns.some(pattern => pattern.test(text));
}

// Redact PII from text
function redactPII(text) {
  if (!text) return text;
  
  let redacted = text;
  
  // Redact phone numbers
  redacted = redacted.replace(/\b\d{11}\b/g, '[PHONE_REDACTED]');
  
  // Redact emails
  redacted = redacted.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[EMAIL_REDACTED]');
  
  // Redact potential credit cards
  redacted = redacted.replace(/\b\d{13,16}\b/g, '[CARD_REDACTED]');
  
  return redacted;
}

// Generate privacy notice for users
function getPrivacyNotice() {
  return `🔒 *Privacy Notice*\n\nYour phone number is hashed for security. We store queries to improve service but never share personal data. Messages are anonymized after 30 days.`;
}

// Data retention helper - marks old data for deletion
async function markForDeletion(supabase, daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  try {
    // This would typically be run as a scheduled job
    const { data, error } = await supabase
      .from('conversations')
      .update({ 
        user_message: '[DELETED]',
        bot_response: '[DELETED]'
      })
      .lt('created_at', cutoffDate.toISOString());
    
    if (error) throw error;
    return { success: true, affected: data?.length || 0 };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = {
  hashPhoneNumber,
  anonymizeConversation,
  containsPII,
  redactPII,
  getPrivacyNotice,
  markForDeletion
};