'use strict';

const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');

const env = require('./config/env');
const { errorHandler } = require('./middleware/errorHandler');
const { sendError } = require('./utils/response');

// Route imports
const healthRouter = require('./routes/health');
const authRouter = require('./routes/auth');
const projectRouter = require('./routes/projects');
const userRouter = require('./routes/users');

const app = express();

// ── Security Headers ──────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// ── CORS & Origin Validation ──────────────────────────────────
const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (allowedOrigins.includes(origin) || !env.isProduction)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-CSRF-Token');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// ── Body & Cookie Parsers ─────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser(env.COOKIE_SECRET));

// ── Static Files (Canonical frontend root) ───────────────────
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));

// ── API Routes ────────────────────────────────────────────────
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/projects', projectRouter);
app.use('/api/users', userRouter);

// ── User-Facing Navigation Routes ─────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

app.get('/login', (req, res) => {
  res.redirect('/pages/auth.html?mode=login');
});

app.get('/register', (req, res) => {
  res.redirect('/pages/auth.html?mode=register');
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(publicPath, 'pages', 'dashboard.html'));
});

app.get('/projects', (req, res) => {
  res.sendFile(path.join(publicPath, 'pages', 'projects.html'));
});

app.get('/projects/:id/members', (req, res) => {
  res.sendFile(path.join(publicPath, 'pages', 'members.html'));
});

app.get('/projects/:id/board', (req, res) => {
  res.sendFile(path.join(publicPath, 'pages', 'board.html'));
});

app.get('/board', (req, res) => {
  res.sendFile(path.join(publicPath, 'pages', 'board.html'));
});

// ── 404 Handler for Unmatched API Routes ──────────────────────
app.use('/api', (req, res) => {
  sendError(res, 404, 'NOT_FOUND', `Route not found: ${req.method} ${req.originalUrl}`);
});

// ── Global Error Handler ──────────────────────────────────────
app.use(errorHandler);

module.exports = app;
