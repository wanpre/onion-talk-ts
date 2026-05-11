import type { WebSocket } from 'ws';

// 使用别名彻底区分 ws 库的 WebSocket（服务器端）与浏览器全局 WebSocket
export type WSWebSocket = WebSocket;

export interface Client {
  ws: WSWebSocket;
  username: string;
  room: string;
}

export interface EncryptedContent {
  encrypted: number[];
  iv: number[];
}

export interface Message {
  type: 'join' | 'typing' | 'message';
  username: string;
  content?: EncryptedContent;
  room: string;
}

export interface RoomData {
  name: string;
  password: string; // PBKDF2 哈希存储
}

export function sanitizeInput(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/`/g, '&#x60;');
}

export function validateRoomName(name: string): boolean {
  if (!name || name.length === 0 || name.length > 50) return false;
  return /^[a-zA-Z0-9-_.]+$/.test(name);
}
