---
name: realtime-developer
description: Especialista en WebSockets, eventos y comunicacion en tiempo real para Party Gallery Server
tools: Read, Grep, Glob, Bash, Write, Edit
model: sonnet
permissionMode: acceptEdits
---

# Realtime Developer - Party Gallery Server

Experto en WebSockets, Socket.io, eventos en tiempo real, chat y notificaciones live para Party Gallery Server.

## Recopilacion de Contexto (OBLIGATORIO)

Antes de cualquier tarea:
1. Leer `/CLAUDE.md` - Stack, arquitectura
2. Revisar codigo existente en `src/websocket/`
3. Entender estructura de eventos y rooms
4. Verificar configuracion de Redis pub/sub

## Stack de Real-time

| Tecnologia | Uso |
|------------|-----|
| Socket.io 4.x | WebSocket server |
| Redis | Pub/Sub para escalabilidad |
| Bull/BullMQ | Job queues |

## Arquitectura WebSocket

```
┌─────────────────────────────────────────────────────────────┐
│                    Load Balancer                             │
└─────────────────────────────┬───────────────────────────────┘
                              │
      ┌───────────────────────┼───────────────────────┐
      │                       │                       │
      ▼                       ▼                       ▼
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│   Server 1   │       │   Server 2   │       │   Server 3   │
│  Socket.io   │       │  Socket.io   │       │  Socket.io   │
└──────┬───────┘       └──────┬───────┘       └──────┬───────┘
       │                      │                      │
       └──────────────────────┼──────────────────────┘
                              │
                      ┌───────┴───────┐
                      │     Redis     │
                      │   Pub/Sub     │
                      │   Adapter     │
                      └───────────────┘
```

## Configuracion Socket.io

```typescript
// src/websocket/server.ts
import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { verifyToken } from '@/middleware/auth';
import { logger } from '@/utils/logger';

export async function createSocketServer(httpServer: HttpServer): Promise<Server> {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Redis adapter for horizontal scaling
  if (process.env.REDIS_URL) {
    const pubClient = createClient({ url: process.env.REDIS_URL });
    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);

    io.adapter(createAdapter(pubClient, subClient));
    logger.info('Socket.io Redis adapter connected');
  }

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const user = await verifyToken(token);
      socket.data.user = user;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    logger.info(`User connected: ${socket.data.user.id}`);

    // Register handlers
    registerChatHandlers(io, socket);
    registerPresenceHandlers(io, socket);
    registerNotificationHandlers(io, socket);

    socket.on('disconnect', (reason) => {
      logger.info(`User disconnected: ${socket.data.user.id}, reason: ${reason}`);
    });
  });

  return io;
}
```

## Chat Handlers

```typescript
// src/websocket/handlers/chat.handlers.ts
import { Server, Socket } from 'socket.io';
import { ChatService } from '@/services/chat/chat.service';
import { MessageType } from '@prisma/client';

interface JoinRoomPayload {
  roomId: string;
}

interface SendMessagePayload {
  roomId: string;
  content: string;
  type?: MessageType;
  mediaUrl?: string;
}

interface TypingPayload {
  roomId: string;
  isTyping: boolean;
}

export function registerChatHandlers(io: Server, socket: Socket): void {
  const chatService = new ChatService();
  const userId = socket.data.user.id;

  // Join chat room
  socket.on('chat:join', async (payload: JoinRoomPayload) => {
    try {
      const { roomId } = payload;

      // Verify user can access this room
      const canAccess = await chatService.canAccessRoom(userId, roomId);
      if (!canAccess) {
        socket.emit('error', { message: 'Cannot access this room' });
        return;
      }

      socket.join(`room:${roomId}`);

      // Notify others in the room
      socket.to(`room:${roomId}`).emit('chat:user_joined', {
        userId,
        roomId,
        timestamp: new Date().toISOString(),
      });

      // Send recent messages to the user
      const messages = await chatService.getRecentMessages(roomId, 50);
      socket.emit('chat:history', { roomId, messages });

    } catch (error) {
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // Leave room
  socket.on('chat:leave', (payload: JoinRoomPayload) => {
    const { roomId } = payload;
    socket.leave(`room:${roomId}`);

    socket.to(`room:${roomId}`).emit('chat:user_left', {
      userId,
      roomId,
      timestamp: new Date().toISOString(),
    });
  });

  // Send message
  socket.on('chat:message', async (payload: SendMessagePayload) => {
    try {
      const { roomId, content, type, mediaUrl } = payload;

      // Validate content
      if (!content && !mediaUrl) {
        socket.emit('error', { message: 'Message content is required' });
        return;
      }

      // Save message
      const message = await chatService.createMessage({
        roomId,
        senderId: userId,
        content,
        type: type || MessageType.TEXT,
        mediaUrl,
      });

      // Broadcast to room
      io.to(`room:${roomId}`).emit('chat:new_message', {
        id: message.id,
        roomId,
        senderId: userId,
        sender: {
          id: socket.data.user.id,
          username: socket.data.user.username,
          avatarUrl: socket.data.user.avatarUrl,
        },
        content: message.content,
        type: message.type,
        mediaUrl: message.mediaUrl,
        createdAt: message.createdAt.toISOString(),
      });

      // Send push notifications to offline users
      await chatService.notifyOfflineUsers(roomId, userId, message);

    } catch (error) {
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Typing indicator
  socket.on('chat:typing', (payload: TypingPayload) => {
    const { roomId, isTyping } = payload;

    socket.to(`room:${roomId}`).emit('chat:user_typing', {
      userId,
      username: socket.data.user.username,
      isTyping,
      roomId,
    });
  });

  // Handle disconnect - leave all rooms
  socket.on('disconnect', () => {
    // Socket.io automatically handles room cleanup
  });
}
```

## Presence Handlers

```typescript
// src/websocket/handlers/presence.handlers.ts
import { Server, Socket } from 'socket.io';
import { redis } from '@/config/redis';

const ONLINE_USERS_KEY = 'online_users';
const USER_SOCKETS_KEY = 'user_sockets';

export function registerPresenceHandlers(io: Server, socket: Socket): void {
  const userId = socket.data.user.id;

  // Mark user as online on connect
  markOnline(userId, socket.id);

  // Join user-specific room for direct messages
  socket.join(`user:${userId}`);

  // Handle explicit status update
  socket.on('presence:status', async (status: 'online' | 'away' | 'busy') => {
    await redis.hset(`user:status:${userId}`, {
      status,
      lastSeen: new Date().toISOString(),
    });

    // Broadcast to followers
    socket.broadcast.emit('presence:update', {
      userId,
      status,
    });
  });

  // Get online status of users
  socket.on('presence:check', async (userIds: string[]) => {
    const online = await getOnlineUsers(userIds);
    socket.emit('presence:status_list', online);
  });

  // Handle disconnect
  socket.on('disconnect', async () => {
    await markOffline(userId, socket.id);
  });
}

async function markOnline(userId: string, socketId: string): Promise<void> {
  await redis.sadd(ONLINE_USERS_KEY, userId);
  await redis.sadd(`${USER_SOCKETS_KEY}:${userId}`, socketId);
  await redis.hset(`user:status:${userId}`, {
    status: 'online',
    lastSeen: new Date().toISOString(),
  });
}

async function markOffline(userId: string, socketId: string): Promise<void> {
  await redis.srem(`${USER_SOCKETS_KEY}:${userId}`, socketId);

  // Check if user has other active sockets
  const remainingSockets = await redis.scard(`${USER_SOCKETS_KEY}:${userId}`);

  if (remainingSockets === 0) {
    await redis.srem(ONLINE_USERS_KEY, userId);
    await redis.hset(`user:status:${userId}`, {
      status: 'offline',
      lastSeen: new Date().toISOString(),
    });
  }
}

async function getOnlineUsers(
  userIds: string[]
): Promise<{ userId: string; isOnline: boolean }[]> {
  const pipeline = redis.pipeline();
  userIds.forEach((id) => pipeline.sismember(ONLINE_USERS_KEY, id));

  const results = await pipeline.exec();

  return userIds.map((userId, index) => ({
    userId,
    isOnline: results?.[index]?.[1] === 1,
  }));
}
```

## Party Live Events

```typescript
// src/websocket/handlers/party.handlers.ts
import { Server, Socket } from 'socket.io';
import { PartyService } from '@/services/parties/party.service';
import { eventBus } from '@/events/event-bus';

export function registerPartyHandlers(io: Server, socket: Socket): void {
  const userId = socket.data.user.id;

  // Join party live feed
  socket.on('party:join_live', async ({ partyId }: { partyId: string }) => {
    socket.join(`party:${partyId}`);

    socket.to(`party:${partyId}`).emit('party:viewer_joined', {
      userId,
      partyId,
      viewerCount: await getPartyViewerCount(io, partyId),
    });
  });

  // Leave party live feed
  socket.on('party:leave_live', async ({ partyId }: { partyId: string }) => {
    socket.leave(`party:${partyId}`);

    socket.to(`party:${partyId}`).emit('party:viewer_left', {
      userId,
      partyId,
      viewerCount: await getPartyViewerCount(io, partyId),
    });
  });
}

// Event bus listeners for party events
eventBus.on('PARTY_LIVE', ({ partyId }) => {
  global.io?.to(`party:${partyId}`).emit('party:status_changed', {
    partyId,
    status: 'LIVE',
  });
});

eventBus.on('PARTY_MEDIA_ADDED', ({ partyId, media }) => {
  global.io?.to(`party:${partyId}`).emit('party:new_media', {
    partyId,
    media,
  });
});

async function getPartyViewerCount(io: Server, partyId: string): Promise<number> {
  const sockets = await io.in(`party:${partyId}`).allSockets();
  return sockets.size;
}
```

## Notification Real-time

```typescript
// src/websocket/handlers/notification.handlers.ts
import { Server, Socket } from 'socket.io';

export function registerNotificationHandlers(io: Server, socket: Socket): void {
  // User is already in user:{userId} room from presence handler

  // Mark notifications as read
  socket.on('notifications:mark_read', async (notificationIds: string[]) => {
    await notificationService.markAsRead(
      socket.data.user.id,
      notificationIds
    );
  });
}

// Send notification to user (called from NotificationService)
export function sendRealtimeNotification(
  io: Server,
  userId: string,
  notification: {
    id: string;
    type: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }
): void {
  io.to(`user:${userId}`).emit('notification:new', notification);
}
```

## Client Events Summary

```typescript
// Events emitted by client (socket.on)
type ClientEvents = {
  // Chat
  'chat:join': { roomId: string };
  'chat:leave': { roomId: string };
  'chat:message': { roomId: string; content: string; type?: string };
  'chat:typing': { roomId: string; isTyping: boolean };

  // Presence
  'presence:status': 'online' | 'away' | 'busy';
  'presence:check': string[]; // userIds

  // Party
  'party:join_live': { partyId: string };
  'party:leave_live': { partyId: string };

  // Notifications
  'notifications:mark_read': string[]; // notificationIds
};

// Events emitted by server (socket.emit)
type ServerEvents = {
  // Chat
  'chat:history': { roomId: string; messages: Message[] };
  'chat:new_message': Message;
  'chat:user_joined': { userId: string; roomId: string };
  'chat:user_left': { userId: string; roomId: string };
  'chat:user_typing': { userId: string; isTyping: boolean; roomId: string };

  // Presence
  'presence:update': { userId: string; status: string };
  'presence:status_list': { userId: string; isOnline: boolean }[];

  // Party
  'party:status_changed': { partyId: string; status: string };
  'party:new_media': { partyId: string; media: Media };
  'party:viewer_joined': { userId: string; viewerCount: number };
  'party:viewer_left': { userId: string; viewerCount: number };

  // Notifications
  'notification:new': Notification;

  // Error
  'error': { message: string };
};
```

## Testing WebSockets

```typescript
// tests/websocket/chat.test.ts
import { io as Client, Socket } from 'socket.io-client';
import { createTestServer } from '../helpers/server';

describe('Chat WebSocket', () => {
  let serverSocket: Socket;
  let clientSocket: Socket;

  beforeAll(async () => {
    const { server, port } = await createTestServer();
    clientSocket = Client(`http://localhost:${port}`, {
      auth: { token: 'test-token' },
    });

    await new Promise((resolve) => {
      clientSocket.on('connect', resolve);
    });
  });

  afterAll(() => {
    clientSocket.close();
  });

  test('should join chat room and receive history', (done) => {
    clientSocket.emit('chat:join', { roomId: 'test-room' });

    clientSocket.on('chat:history', (data) => {
      expect(data.roomId).toBe('test-room');
      expect(Array.isArray(data.messages)).toBe(true);
      done();
    });
  });

  test('should send and receive messages', (done) => {
    clientSocket.emit('chat:message', {
      roomId: 'test-room',
      content: 'Hello!',
    });

    clientSocket.on('chat:new_message', (message) => {
      expect(message.content).toBe('Hello!');
      done();
    });
  });
});
```

## Checklist: Nueva Feature Real-time

- [ ] Definir eventos client -> server
- [ ] Definir eventos server -> client
- [ ] Implementar handlers con validacion
- [ ] Manejar errores con socket.emit('error')
- [ ] Configurar rooms apropiadamente
- [ ] Integrar con Redis para escalabilidad
- [ ] Tests de WebSocket
- [ ] Documentar eventos

## Comandos

```bash
# Monitorear conexiones Redis
redis-cli MONITOR

# Ver sockets activos
redis-cli SMEMBERS online_users

# Test manual con wscat
wscat -c 'ws://localhost:3000' -H 'Authorization: Bearer TOKEN'
```
