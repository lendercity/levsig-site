// netlify/functions/subscribe.js
// Adds email to SendGrid levsig-free contact list
// Called from landing page signup form

const https = require('https');

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_LIST_ID = process.env.SENDGRID_LIST_ID || '6beb1225-5c77-4223-a83b-72c72582fe15';

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': 'https://levsig.com',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  // Parse email from request body
  let email;
  try {
    const body = JSON.parse(event.body);
    email = body.email?.trim().toLowerCase();
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request' }) };
  }

  // Validate email
  if (!email || !email.includes('@') || !email.includes('.')) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid email address' }) };
  }

  if (!SENDGRID_API_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server configuration error' }) };
  }

  // Add to SendGrid contact list
  try {
    const result = await addToSendGrid(email);
    if (result.success) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: 'You\'re on the list!' })
      };
    } else {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to subscribe. Please try again.' })
      };
    }
  } catch (e) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Server error. Please try again.' })
    };
  }
};

function addToSendGrid(email) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      list_ids: [SENDGRID_LIST_ID],
      contacts: [{ email }]
    });

    const options = {
      hostname: 'api.sendgrid.com',
      path: '/v3/marketing/contacts',
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        // SendGrid returns 202 for successful contact add
        if (res.statusCode === 202) {
          resolve({ success: true });
        } else {
          console.error('SendGrid error:', res.statusCode, data);
          resolve({ success: false, error: data });
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}
