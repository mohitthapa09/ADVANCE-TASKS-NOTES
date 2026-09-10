// Server-side helper for sending SMS reminders via Twilio.
// This module is intended to run inside Firebase Cloud Functions (see functions/index.js),
// never in the browser bundle, since it needs the Twilio auth token to stay secret.
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
 * Sends a plain SMS reminder.
 * @param {string} to - E.164 formatted phone number, e.g. +15551234567
 * @param {string} body - Message text
 */
const sendSms = async (to, body) => {
  const sms = getClient();
  return sms.messages.create({
    to,
    from: process.env.TWILIO_FROM_NUMBER,
    body
  });
};

module.exports = { sendSms };
