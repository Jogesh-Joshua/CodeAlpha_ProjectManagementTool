'use strict';

require('dotenv').config();

/**
 * Orbit Environment Configuration & Fail-Fast Validator
 */

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';
const isTest = NODE_ENV === 'test';

const errors = [];

// In production, secrets and database URL are strictly mandatory
if (isProduction) {
  if (!process.env.DATABASE_URL) {
    errors.push('DATABASE_URL is required in production.');
  }
  if (!process.env.COOKIE_SECRET || process.env.COOKIE_SECRET.length < 32) {
    errors.push('COOKIE_SECRET must be at least 32 characters long in production.');
  }
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    errors.push('SESSION_SECRET must be at least 32 characters long in production.');
  }
}

if (errors.length > 0) {
  throw new Error(`[Configuration Error]\n - ${errors.join('\n - ')}`);
}

const env = {
  NODE_ENV,
  isProduction,
  isTest,
  PORT: parseInt(process.env.PORT || '3000', 10),
  DATABASE_URL: process.env.DATABASE_URL || '',
  COOKIE_SECRET: process.env.COOKIE_SECRET || 'dev_cookie_secret_at_least_32_characters_long_for_orbit',
  SESSION_SECRET: process.env.SESSION_SECRET || 'dev_session_secret_at_least_32_characters_long_for_orbit',
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',
  AUTH_RATE_LIMIT_WINDOW_MS: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '900000', 10),
  AUTH_RATE_LIMIT_MAX: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '100', 10),
  REDIS_URL: process.env.REDIS_URL || '',
};

module.exports = env;
