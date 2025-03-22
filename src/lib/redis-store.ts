import { Redis } from 'ioredis';
import { storeSecureData, getSecureData, removeSecureData } from './encryption';

interface RedisConnection {
  client: Redis;
  timestamp: number;
  info?: Record<string, string>;
}

interface SensitiveConnectionData {
  password?: string;
  username?: string;
}

declare global {
  // eslint-disable-next-line no-var
  var redisStore: typeof redisStoreImpl;
}

const connections: Record<string, RedisConnection> = {};

export const redisStoreImpl = {
  addConnection(id: string, client: Redis, sensitiveData?: SensitiveConnectionData): void {
    connections[id] = {
      client,
      timestamp: Date.now(),
    };
    
    if (sensitiveData) {
      storeSecureData(id, sensitiveData as unknown as Record<string, string>);
    }
    
    console.log(`Connection ${id}: Added to global store`);
  },

  getConnection(id: string): Redis | null {
    if (!connections[id]) {
      console.log(`Connection ${id}: Not found in global store`);
      return null;
    }
    return connections[id].client;
  },

  getSensitiveData(id: string): SensitiveConnectionData | null {
    return getSecureData(id) as SensitiveConnectionData | null;
  },
  removeConnection(id: string): void {
    if (connections[id]) {
      try {
        connections[id].client.disconnect();
      } catch (error) {
        console.error(`Error disconnecting Redis client for ${id}:`, error);
      }
      delete connections[id];
      
      removeSecureData(id);
      
      console.log(`Connection ${id}: Removed from global store`);
    }
  },

  storeConnectionInfo(id: string, info: Record<string, string>): void {
    if (connections[id]) {
      connections[id].info = info;
    }
  },

  getConnectionInfo(id: string): Record<string, string> | undefined {
    return connections[id]?.info;
  },

  getConnectionIds(): string[] {
    return Object.keys(connections);
  },
  getConnections(): Record<string, RedisConnection> {
    return { ...connections };
  },

  debugConnections(): string[] {
    return Object.keys(connections).map(id => {
      const conn = connections[id];
      return `${id}: ${conn.client.options.host}:${conn.client.options.port} (${new Date(conn.timestamp).toISOString()})`;
    });
  }
};

if (typeof global.redisStore === 'undefined') {
  global.redisStore = redisStoreImpl;
  console.log('Initialized global Redis connections store');
}
export const redisStore = global.redisStore;
export default redisStore;
