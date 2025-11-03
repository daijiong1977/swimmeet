import {
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
  const compressed = compressToEncodedURIComponent(json);
  if (compressed) {
    return `lz:${compressed}`;
  }
  return `b64:${base64Encode(json)}`;
};

export const decodeSharePayload = (token: string): SharePayload => {
  let json: string | null = null;
  if (token.startsWith('lz:')) {
    json = decompressFromEncodedURIComponent(token.slice(3));
  }
  if (!json) {
    const base = token.startsWith('b64:') ? token.slice(4) : token;
    json = base64Decode(base);
  }
  return JSON.parse(json) as SharePayload;
};
