// Server-side helper for sending WhatsApp reminders via the Twilio WhatsApp API.
// Intended to run inside Firebase Cloud Functions (see functions/index.js).
const twilio = require('twilio');

let client = null;

const getClient = () => {
  if (!client) {
    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      throw new Error('Twilio credentials are not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.');
    }
    client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  }
  return client;
};

/**
 * Sends a WhatsApp reminder message.
 * @param {string} to - E.164 formatted phone number, e.g. +15551234567 (no "whatsapp:" prefix needed)
 * @param {string} body - Message text
 */
const sendWhatsapp = async (to, body) => {
  const wa = getClient();
  return wa.messages.create({
    to: `whatsapp:${to}`,
    from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
    body
  });
};

module.exports = { sendWhatsapp };
