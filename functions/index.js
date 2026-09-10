const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { sendSms } = require('../services/Twilio');
const { sendWhatsapp } = require('../services/whatsapp');

initializeApp();
const db = getFirestore();

/**
 * Fires whenever a new notification document is created (e.g. by
 * components/notifications.js on the client). Pushes it to the user's
 * device via FCM if they have a saved token.
 */
exports.onNotificationCreated = onDocumentCreated('notifications/{notificationId}', async (event) => {
  const notification = event.data.data();
  if (!notification?.uid) return;

  const userSnap = await db.collection('users').doc(notification.uid).get();
  const user = userSnap.data();
  if (!user?.fcmToken) return;

  try {
    await getMessaging().send({
      token: user.fcmToken,
      notification: {
        title: notification.title || 'ATN Workspace',
        body: notification.body || 'You have a new reminder.'
      }
    });
  } catch (err) {
    console.error('Failed to send FCM push', err);
  }
});

/**
 * Runs every 5 minutes, finds tasks whose reminderDate has just passed and
 * haven't been notified yet, creates a notification doc for each, and — if
 * the user has a phone number on file — sends an SMS/WhatsApp nudge too.
 */
exports.checkTaskReminders = onSchedule('every 5 minutes', async () => {
  const now = Timestamp.now();
  const tasksSnap = await db
    .collection('tasks')
    .where('reminderDate', '<=', now)
    .where('reminderNotified', '==', false)
    .get();

  for (const taskDoc of tasksSnap.docs) {
    const task = taskDoc.data();

    await db.collection('notifications').add({
      uid: task.uid,
      type: 'task-reminder',
      refId: taskDoc.id,
      title: `Reminder: ${task.title}`,
      read: false,
      timestamp: now
    });

    await taskDoc.ref.update({ reminderNotified: true });

    const userSnap = await db.collection('users').doc(task.uid).get();
    const user = userSnap.data();
    if (user?.phoneNumber) {
      const message = `⏰ ATN Workspace reminder: "${task.title}" is due now.`;
      try {
        if (user.notifyVia === 'whatsapp') {
          await sendWhatsapp(user.phoneNumber, message);
        } else {
          await sendSms(user.phoneNumber, message);
        }
      } catch (err) {
        console.error(`Failed to notify user ${task.uid}`, err);
      }
    }
  }
});
