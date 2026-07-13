import axios from 'axios';
import { storage } from '../lib/storage';

// API base URL comes from env — never hardcode localhost (Capacitor-safe).
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:4000',
});

api.interceptors.request.use((config) => {
  const token = storage.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      storage.clear();
      if (!location.hash.startsWith('#/login')) location.hash = '#/login';
    }
    return Promise.reject(error);
  },
);
