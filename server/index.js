
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { users, sessions, createUser, findUser, createSession, getSession } from './db/stubs.js';

dotenv.config();

const app = express();
const PORT = 3001;
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com';

app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));
app.use(cookieParser());
app.use(express.json());

// Middleware to check auth
const requireAuth = (req, res, next) => {
    const token = req.cookies.session_token;
    // Allow if needed, or check token
    next();
};

// Generic Proxy to Gemini
app.use('/api/proxy', requireAuth, async (req, res) => {
    try {
        console.log(`[Proxy] Request received: ${req.method} ${req.url}`);
        console.log(`[Proxy] API Key present: ${!!process.env.GEMINI_API_KEY}`);

        // req.url starts with /v1beta... (relative to /api/proxy)
        const targetUrl = `${GEMINI_BASE_URL}${req.url}`;
        console.log(`[Proxy] Proxying to: ${targetUrl}`);

        const options = {
            method: req.method,
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': process.env.GEMINI_API_KEY
            }
        };

        if (req.method !== 'GET' && req.method !== 'HEAD') {
            if (req.body && Object.keys(req.body).length > 0) {
                options.body = JSON.stringify(req.body);
            }
        }

        const response = await fetch(targetUrl, options);
        console.log(`[Proxy] Gemini response status: ${response.status}`);

        // Forward headers
        response.headers.forEach((val, key) => {
            if (key !== 'content-encoding' && key !== 'content-length') res.setHeader(key, val);
        });
        res.status(response.status);

        const text = await response.text();
        console.log(`[Proxy] Response body preview: ${text.substring(0, 100)}...`);
        res.send(text);

    } catch (error) {
        console.error('Proxy Error:', error);
        res.status(500).json({ error: 'Failed to fetch from Gemini' });
    }
});

// Sync user from Clerk
app.post('/api/auth/sync', (req, res) => {
    const { email, token } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    let user = findUser(email);
    if (!user) {
        user = createUser(email, token);
    }
    const session = createSession(user.id, token);

    res.cookie('session_token', token, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/'
    });
    res.json({ user, session });
});

app.get('/api/session', (req, res) => {
    const token = req.cookies.session_token;
    if (token && getSession(token)) {
        res.json({ authenticated: true });
    } else {
        res.json({ authenticated: false });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
