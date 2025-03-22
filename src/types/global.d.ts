import { Redis } from 'ioredis';

declare global {
  // eslint-disable-next-line no-var
  var redisStore: {
    addConnection(id: string, client: Redis, sensitiveData?: Record<string, string | undefined>): void;
    getConnection(id: string): Redis | null;
    getSensitiveData(id: string): Record<string, string | undefined> | null;
    removeConnection(id: string): void;
    storeConnectionInfo(id: string, info: Record<string, string>): void;
    getConnectionInfo(id: string): Record<string, string> | undefined;
    getConnectionIds(): string[];
    getConnections(): Record<string, { client: Redis; timestamp: number; info?: Record<string, string> }>;
    debugConnections(): string[];
  };

  // eslint-disable-next-line no-var
  var secureStore: Record<string, Record<string, string>> | undefined;
}
