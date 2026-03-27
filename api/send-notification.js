'use strict';
// api/send-notification.js

const { GoogleAuth } = require('google-auth-library');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token, title, body, data } = req.body;

    if (!token || !title || !body) {
      return res.status(400).json({ error: 'Faltan campos: token, title, body' });
    }

    // Construir credenciales desde variables de entorno
    const credentials = {
      type: 'service_account',
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: 'c5e8d89d4f2c8f398d742faaba852207574c2620',
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      token_uri: 'https://oauth2.googleapis.com/token',
    };

    // Obtener access token de Google
    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
    });

    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    // Enviar notificación via FCM HTTP v1
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${process.env.FIREBASE_PROJECT_ID}/messages:send`;

    const message = {
      message: {
        token: token,
        notification: {
          title: title,
          body: body,
        },
        data: data || {},
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            click_action: 'FLUTTER_NOTIFICATION_CLICK',
          },
        },
      },
    };

    const response = await fetch(fcmUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken.token}`,
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('FCM error:', result);
      return res.status(500).json({ error: 'Error enviando notificación', detail: result });
    }

    return res.status(200).json({ success: true, result });

  } catch (err) {
    console.error('send-notification error:', err);
    return res.status(500).json({ error: err.message });
  }
};