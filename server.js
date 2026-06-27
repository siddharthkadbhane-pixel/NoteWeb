/**
 * NoteWeb AI Academic Assistant API Server
 * 
 * This server provides a secure, lightweight microservice to extract text from PDFs
 * and generate summaries utilizing Google Gemini AI.
 * 
 * Features:
 * - 100% independent of Supabase storage or database writes (No load on Supabase).
 * - Secure: API keys are stored on the server side, not exposed to the client.
 * - Dynamic: Can summarize text sent directly from the client OR download and parse a PDF URL on the fly.
 * 
 * Setup:
 * 1. Run: npm install express cors dotenv pdf-parse
 * 2. Create a .env file on the server (or set environment variables) with:
 *    PORT=5000
 *    GEMINI_API_KEY=your_gemini_api_key_here
 * 3. Run: node server.js
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Supabase Client (For retrieving user device tokens)
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://uyqegcuithhbnvviujbv.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Firebase Admin SDK for FCM
let messaging = null;
const serviceAccountPath = path.resolve('./firebase-service-account.json');

if (fs.existsSync(serviceAccountPath)) {
  try {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    messaging = admin.messaging();
    console.log('[NoteWeb Notifications] Firebase Admin successfully initialized.');
  } catch (err) {
    console.error('[NoteWeb Notifications] Failed to initialize Firebase Admin SDK:', err);
  }
} else {
  console.log('[NoteWeb Notifications] Warning: firebase-service-account.json not found. Push Notifications will run in MOCK MODE.');
}

// Enable CORS so the NoteWeb frontend can call this API
app.use(cors({
  origin: '*', // Allow all origins or specify your Electron/web URL
}));
app.use(express.json({ limit: '10mb' })); // Support larger text payloads

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyDIl1qpIw0n9iZV4wh5ICSjsne4n092lCE';

/**
 * Helper to call Gemini 1.5 Flash API directly on the server
 */
async function callGemini(systemInstruction, prompt) {
  const model = 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
  
  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: `${systemInstruction}\n\nUser request:\n${prompt}` }
        ]
      }
    ]
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.statusText} (${errorText})`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Empty response received from Gemini.");
  }
  return text;
}

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'NoteWeb AI Service is running.' });
});

/**
 * POST /api/summarize
 * Body params:
 * - text (optional): Extracted PDF text. If provided, bypasses PDF download.
 * - pdfUrl (optional): Cloudinary/Remote PDF URL to download and summarize.
 */
app.post('/api/summarize', async (req, res) => {
  try {
    const { text, pdfUrl } = req.body;
    let textToAnalyze = '';

    // Step 1: Resolve text (either direct or download/parse PDF)
    if (text && text.trim().length > 0) {
      textToAnalyze = text;
      console.log(`[NoteWeb AI] Summarizing text provided directly by client (${textToAnalyze.length} chars).`);
    } else if (pdfUrl && pdfUrl.startsWith('http')) {
      console.log(`[NoteWeb AI] Downloading and parsing PDF from Cloudinary URL: ${pdfUrl}`);
      
      const pdfResponse = await fetch(pdfUrl);
      if (!pdfResponse.ok) {
        return res.status(400).json({ error: `Failed to download PDF from Cloudinary: ${pdfResponse.statusText}` });
      }

      const pdfBuffer = await pdfResponse.buffer();
      const parsedPdf = await pdfParse(pdfBuffer);
      textToAnalyze = parsedPdf.text;
      
      console.log(`[NoteWeb AI] Successfully parsed PDF (${textToAnalyze.length} chars).`);
    } else {
      return res.status(400).json({ error: 'Please provide either "text" or a valid "pdfUrl".' });
    }

    if (!textToAnalyze || textToAnalyze.trim().length === 0) {
      return res.status(400).json({ error: 'Extracted text layer is empty. Ensure the PDF is searchable.' });
    }

    // Step 2: Call Gemini to summarize the text
    const systemInstruction = "You are NoteWeb's expert AI Academic Assistant. Your task is to analyze course notes and generate a highly professional, beautifully structured academic study summary.";
    
    const prompt = `Analyze the following course notes:
\"\"\"
${textToAnalyze.slice(0, 15000)}
\"\"\"

Please format your response in clean Markdown exactly as follows:

### 📚 Key Concepts Covered
- [Provide a concise, 2-3 sentence overview of the subject matter and primary concepts discussed.]

### 💡 Detailed Core Insights
- **[Insight Title 1]**: [Detailed explanation of a major rule, theory, formula, or concept discussed.]
- **[Insight Title 2]**: [Explanation of another key study point or method.]
- **[Insight Title 3]**: [Add another core learning insight.]

### ✏️ Study & Revision Checklist
- [ ] **[Topic/Question 1]**: [A practice question or revision challenge for this material.]
- [ ] **[Topic/Question 2]**: [Another practice prompt.]
- [ ] **[Topic/Question 3]**: [A practical application challenge.]

Make the tone encouraging, highly academic, and exceptionally clear for university study.`;

    const summary = await callGemini(systemInstruction, prompt);
    
    // Return the response to NoteWeb client
    res.json({ summary });

  } catch (error) {
    console.error('[NoteWeb AI] Summarization failure:', error);
    res.status(500).json({ error: error.message || 'Internal AI service failure.' });
  }
});

/**
 * POST /api/send-notification
 * Body params:
 * - sender_id: string
 * - sender_name: string
 * - message: string
 * - recipient_id (optional): string (for DMs)
 * - is_global: boolean
 */
app.post('/api/send-notification', async (req, res) => {
  try {
    const { sender_id, sender_name, message, recipient_id, is_global } = req.body;
    
    if (!sender_id || !sender_name || !message) {
      return res.status(400).json({ error: 'Missing required fields: sender_id, sender_name, message.' });
    }

    console.log(`[NoteWeb Notifications] Dispatching notification for message from "${sender_name}": "${message.substring(0, 30)}..."`);

    let targetTokens = [];

    if (is_global) {
      // Fetch all user tokens except the sender
      const { data, error } = await supabase
        .from('user_device_tokens')
        .select('token')
        .neq('profile_id', sender_id);
      
      if (error) {
        console.error('[NoteWeb Notifications] Error fetching global tokens:', error);
        return res.status(500).json({ error: error.message });
      }
      
      if (data) {
        targetTokens = data.map(t => t.token);
      }
    } else {
      // Fetch recipient's tokens
      if (!recipient_id) {
        return res.status(400).json({ error: 'recipient_id is required for direct messages.' });
      }

      const { data, error } = await supabase
        .from('user_device_tokens')
        .select('token')
        .eq('profile_id', recipient_id);

      if (error) {
        console.error('[NoteWeb Notifications] Error fetching DM tokens:', error);
        return res.status(500).json({ error: error.message });
      }

      if (data) {
        targetTokens = data.map(t => t.token);
      }
    }

    // Filter out duplicates and empty values
    targetTokens = [...new Set(targetTokens)].filter(Boolean);

    if (targetTokens.length === 0) {
      console.log('[NoteWeb Notifications] No registered device tokens found for target.');
      return res.json({ success: true, message: 'No registered device tokens found.', sentCount: 0 });
    }

    console.log(`[NoteWeb Notifications] Sending FCM push notifications to ${targetTokens.length} devices...`);

    if (messaging) {
      const payload = {
        notification: {
          title: is_global ? `💬 Global: ${sender_name}` : `✉️ DM: ${sender_name}`,
          body: message.length > 100 ? `${message.substring(0, 97)}...` : message
        },
        data: {
          route: is_global ? '/chat' : `/chat?dm=${sender_id}`,
          click_action: 'FLUTTER_NOTIFICATION_CLICK' // Native click handler compatibility
        }
      };

      // FCM sendMulticast sends to up to 500 tokens in one call
      const chunks = [];
      for (let i = 0; i < targetTokens.length; i += 500) {
        chunks.push(targetTokens.slice(i, i + 500));
      }

      let successCount = 0;
      let failureCount = 0;

      for (const chunk of chunks) {
        const response = await messaging.sendEachForMulticast({
          tokens: chunk,
          notification: payload.notification,
          data: payload.data,
          android: {
            priority: 'high',
            notification: {
              sound: 'default',
              clickAction: 'FLUTTER_NOTIFICATION_CLICK'
            }
          }
        });
        
        successCount += response.successCount;
        failureCount += response.failureCount;
        
        // Log errors or remove stale tokens
        response.responses.forEach(async (resp, idx) => {
          if (!resp.success) {
            const error = resp.error;
            const token = chunk[idx];
            console.warn(`[NoteWeb Notifications] Error sending to token:`, error.code, error.message);
            // Clean up invalid tokens automatically from Supabase database
            if (
              error.code === 'messaging/invalid-registration-token' ||
              error.code === 'messaging/registration-token-not-registered'
            ) {
              console.log(`[NoteWeb Notifications] Deleting stale/invalid token from database: ${token}`);
              await supabase.from('user_device_tokens').delete().eq('token', token);
            }
          }
        });
      }

      console.log(`[NoteWeb Notifications] Dispatch finished. Success: ${successCount}, Failures: ${failureCount}`);
      return res.json({ success: true, sentCount: successCount, failureCount });
    } else {
      console.log(`[NoteWeb Notifications] [MOCK MODE] Sent notifications to tokens:`, targetTokens);
      return res.json({
        success: true,
        message: 'FCM disabled. Logged push payload in Mock Mode.',
        sentCount: targetTokens.length,
        mocked: true
      });
    }
  } catch (err) {
    console.error('[NoteWeb Notifications] Push dispatch failed:', err);
    res.status(500).json({ error: err.message || 'Push dispatch failed.' });
  }
});

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 NoteWeb AI API Server running on port ${PORT}`);
  console.log(`🔗 Endpoint: http://localhost:${PORT}/api/summarize`);
  console.log(`==================================================`);
});
