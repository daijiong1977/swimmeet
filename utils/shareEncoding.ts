import {
  compressToBase64,
  decompressFromBase64,
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from 'lz-string';
import { SharePayload } from '../types';

export const base64Encode = (input: string): string => {
  if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
    return window.btoa(unescape(encodeURIComponent(input)));
  }
  if (typeof globalThis !== 'undefined') {
    const buffer = (globalThis as unknown as { Buffer?: typeof Buffer }).Buffer;
    if (buffer) {
      return buffer.from(input, 'utf-8').toString('base64');
    }
  }
  return input;
};

export const base64Decode = (input: string): string => {
  if (typeof window !== 'undefined' && typeof window.atob === 'function') {
    return decodeURIComponent(escape(window.atob(input)));
  }
  if (typeof globalThis !== 'undefined') {
    const buffer = (globalThis as unknown as { Buffer?: typeof Buffer }).Buffer;
    if (buffer) {
      return buffer.from(input, 'base64').toString('utf-8');
    }
  }
  return input;
};

export const encodeSharePayload = (payload: SharePayload): string => {
  const json = JSON.stringify(payload);
  const compressed = compressToBase64(json);
  if (compressed) {
    return compressed;
  }
  return base64Encode(json);
};

export const decodeSharePayload = (token: string): SharePayload => {
  let json: string | null = null;
  
  // Try lz-string base64 format first (new format)
  json = decompressFromBase64(token);
  
  // Fallback to old lz: prefix format for backward compatibility
  if (!json && token.startsWith('lz:')) {
    json = decompressFromEncodedURIComponent(token.slice(3));
  }
  
  // Fallback to plain base64
  if (!json) {
    const base = token.startsWith('b64:') ? token.slice(4) : token;
    json = base64Decode(base);
  }
  
  return JSON.parse(json) as SharePayload;
};
