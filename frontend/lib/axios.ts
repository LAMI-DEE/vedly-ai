import axios from 'axios';

export const api = axios.create({
  // It looks for our .env variable, but falls back to localhost just in case
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // It attaches the cookie to every request automatically.
});

// We can add "interceptors" here later if we need to attach auth tokens!