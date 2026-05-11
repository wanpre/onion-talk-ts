const WS_URL = 'ws://localhost:8080/ws';

let ws: WebSocket;
let currentUsername = '';
let currentRoom = '';
let encryptionKey: CryptoKey | null = null;

async function generateRoomKey(roomName: string, password: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(roomName + password));
  return crypto.subtle.importKey('raw', hashBuffer, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encryptMessage(text: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, encryptionKey!, new TextEncoder().encode(text));
  return { encrypted: Array.from(new Uint8Array(encrypted)), iv: Array.from(iv) };
}

async function decryptMessage(encryptedData: number[], iv: number[]) {
  try {
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(iv) }, encryptionKey!, new Uint8Array(encryptedData));
    return new TextDecoder().decode(decrypted);
  } catch {
    return '<span class="text-danger">Unable to decrypt message</span>';
  }
}

function escapeHtml(unsafe: string): string {
  return unsafe.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function showError(message: string) {
  const el = document.getElementById('errorMessage') as HTMLElement;
  el.textContent = message;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 3000);
}

function addMessage(username: string, content: string, isSelf = false) {
  const messagesEl = document.getElementById('messages') as HTMLElement;
  const align = isSelf ? 'text-end' : '';
  const bubbleClass = isSelf ? 'bg-primary text-white ms-auto' : 'bg-light text-dark border';

  let html = `<div class="d-block mb-3 ${align}">`;
  html += `<small class="text-muted d-block mb-1">${escapeHtml(username)}</small>`;
  html += `<div style="width: fit-content; max-width: 75%;" class="${bubbleClass} p-3 rounded">${content}</div>`;
  html += `</div>`;

  messagesEl.innerHTML += html;
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function connectWebSocket() {
  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'join', username: currentUsername, room: currentRoom }));
  };

  ws.onmessage = async (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'typing' && msg.username !== currentUsername) {
      const typingEl = document.getElementById('typingIndicator') as HTMLElement;
      typingEl.textContent = `${msg.username} is typing...`;
      setTimeout(() => { typingEl.textContent = ''; }, 1000);
    } else if (msg.type === 'message') {
      const decrypted = await decryptMessage(msg.content.encrypted, msg.content.iv);
      addMessage(msg.username, decrypted, msg.username === currentUsername);
    }
  };

  ws.onclose = () => location.reload();
}

async function joinRoom() {
  const usernameInput = (document.getElementById('username') as HTMLInputElement).value.trim();
  const roomInput = (document.getElementById('room') as HTMLInputElement).value.trim();
  const password = (document.getElementById('password') as HTMLInputElement).value;

  if (!usernameInput || !roomInput || !password) {
    showError('Please fill in all fields.');
    return;
  }

  if (!(document.getElementById('disclaimer') as HTMLInputElement).checked) {
    showError('Please read the disclaimer first.');
    return;
  }

  currentUsername = usernameInput + '#' + Math.floor(100000 + Math.random() * 900000);
  currentRoom = roomInput;

  try {
    encryptionKey = await generateRoomKey(currentRoom, password);

    const res = await fetch('/create-room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: currentRoom, password })
    });

    if (!res.ok) {
      showError('Error joining room');
      return;
    }

    (document.getElementById('loginForm') as HTMLElement).classList.add('d-none');
    (document.getElementById('chatInterface') as HTMLElement).classList.remove('d-none');
    (document.getElementById('roomName') as HTMLElement).textContent = currentRoom;

    connectWebSocket();
  } catch (e) {
    showError('Encryption initialization failed');
  }
}

// 事件绑定
document.getElementById('joinBtn')!.addEventListener('click', joinRoom);

document.getElementById('sendBtn')!.addEventListener('click', async () => {
  const input = document.getElementById('messageInput') as HTMLInputElement;
  const content = input.value.trim();
  if (!content || !encryptionKey) return;

  const encrypted = await encryptMessage(content);
  ws.send(JSON.stringify({
    type: 'message',
    username: currentUsername,
    content: encrypted,
    room: currentRoom
  }));
  input.value = '';
});

document.getElementById('messageInput')!.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') (document.getElementById('sendBtn') as HTMLButtonElement).click();
});

document.getElementById('messageInput')!.addEventListener('input', () => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'typing', username: currentUsername, room: currentRoom }));
  }
});

document.getElementById('exitBtn')!.addEventListener('click', () => location.reload());
