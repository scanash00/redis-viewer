import { NextRequest, NextResponse } from 'next/server';
import { Redis, RedisOptions } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { logRequest } from '@/lib/request-logger';
import { redisStore } from '@/lib/redis-store';

function debugConnections(): string[] {
  return redisStore.debugConnections();
}

interface ConnectRequest {
  host?: string;
  port?: number;
  db?: number;
  password?: string;
  username?: string;
  name?: string;
  tls?: boolean;
  url?: string;
}

function parseRedisUrl(url: string): {
  host: string;
  port: number;
  db: number;
  username?: string;
  password?: string;
  tls: boolean;
} {
    const result: {
    host: string;
    port: number;
    db: number;
    username?: string;
    password?: string;
    tls: boolean;
  } = {
    host: 'localhost',
    port: 6379,
    db: 0,
    tls: false
  };

  try {
    const parsedUrl = new URL(url);
    
    if (!['redis:', 'rediss:'].includes(parsedUrl.protocol)) {
      throw new Error('Invalid Redis URL protocol. Must be redis:// or rediss://');
    }
    
    result.tls = parsedUrl.protocol === 'rediss:';
    
    if (parsedUrl.hostname) {
      result.host = parsedUrl.hostname;
    }
    
    if (parsedUrl.port) {
      result.port = parseInt(parsedUrl.port, 10);
    }
    
    if (parsedUrl.pathname && parsedUrl.pathname !== '/') {
      const pathname = parsedUrl.pathname.startsWith('/') ? parsedUrl.pathname.substring(1) : parsedUrl.pathname;
      
      if (result.host.includes('upstash.io')) {
        result.tls = true;
        
        const pathParts = pathname.split('/');
        if (pathParts.length > 0) {
          const dbNumber = parseInt(pathParts[0], 10);
          if (!isNaN(dbNumber)) {
            result.db = dbNumber;
          }
        }
      } else {
        const dbNumber = parseInt(pathname, 10);
        if (!isNaN(dbNumber)) {
          result.db = dbNumber;
        }
      }
    }
    
    if (parsedUrl.username) {
      result.username = decodeURIComponent(parsedUrl.username);
    }
    
    if (parsedUrl.password) {
      result.password = decodeURIComponent(parsedUrl.password);
    }
    
    return result;
  } catch (err) {
    console.error('Error parsing Redis URL:', err);
    throw new Error('Invalid Redis URL format');
  }
}

export async function GET(): Promise<NextResponse> {
  debugConnections();
  const connectionIds = redisStore.getConnectionIds();
  return NextResponse.json({
    success: true,
    connections: connectionIds,
    count: connectionIds.length,
    debug: debugConnections()
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const data: ConnectRequest = await req.json();
    
    let connectionConfig: {
      host: string;
      port: number;
      db: number;
      password?: string;
      username?: string;
      name?: string;
      tls?: boolean;
    };
    
    if (data.url) {
      try {
        const parsedUrl = parseRedisUrl(data.url);
        connectionConfig = {
          ...parsedUrl,
          name: data.name || data.url,
        };
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_error) {
        return NextResponse.json({
          success: false,
          message: 'Invalid Redis URL format',
        }, { status: 400 });
      }
    } else {
      if (!data.host) {
        return NextResponse.json({
          success: false,
          message: 'Host is required',
        }, { status: 400 });
      }
      
      connectionConfig = {
        host: data.host,
        port: data.port || 6379,
        db: data.db || 0,
        password: data.password,
        username: data.username,
        name: data.name,
        tls: data.tls,
      };
    }
    
    const connectionId = uuidv4();
    console.log('===== DEBUG: CREATING NEW CONNECTION =====');
    console.log('New connection ID:', connectionId);
    console.log('Connection details:', { 
      host: connectionConfig.host, 
      port: connectionConfig.port, 
      db: connectionConfig.db, 
      name: connectionConfig.name,
      tls: connectionConfig.tls ? 'enabled' : 'disabled'
    });
    
    logRequest(
      'connect', 
      `Connected to Redis at ${connectionConfig.host}:${connectionConfig.port}/${connectionConfig.db}${connectionConfig.tls ? ' (TLS)' : ''}`, 
      connectionId, 
      req
    );
    
    const redisOptions: RedisOptions = {
      host: connectionConfig.host,
      port: connectionConfig.port,
      db: connectionConfig.db,
      password: connectionConfig.password || undefined,
      username: connectionConfig.username || undefined,
      connectTimeout: 10000, 
      retryStrategy: (times: number) => {
        console.log(`Retry attempt ${times} for connection ${connectionId}`);
        if (times <= 1) {
          return 2000;
        }
        return null;
      }
    };
    
    if (connectionConfig.tls || connectionConfig.host.includes('upstash.io')) {
      redisOptions.tls = {
        rejectUnauthorized: false
      };
    }
    
    const client = new Redis(redisOptions);
    
    client.on('connect', () => {
      console.log(`Connection ${connectionId}: Connected to Redis`);
    });
    
    client.on('ready', () => {
      console.log(`Connection ${connectionId}: Redis connection ready`);
    });
    
    client.on('error', (err) => {
      console.error(`Connection ${connectionId}: Redis error:`, err.message);
    });
    
    client.on('close', () => {
      console.log(`Connection ${connectionId}: Redis connection closed`);
    });
    
    client.on('reconnecting', () => {
      console.log(`Connection ${connectionId}: Redis reconnecting...`);
    });
    
    client.on('end', () => {
      console.log(`Connection ${connectionId}: Redis connection ended`);
      if (redisStore.getConnection(connectionId)) {
        console.log(`Connection ${connectionId}: Removing from registry after end event`);
        redisStore.removeConnection(connectionId);
      }
    });
    
    console.log(`Connection ${connectionId}: Testing with PING`);
    const pingResult = await Promise.race([
      client.ping(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 8000)
      )
    ]);
    
    console.log(`Connection ${connectionId}: Ping result:`, pingResult);
    
    if (pingResult !== 'PONG') {
      throw new Error('Invalid ping response from Redis server');
    }
    
    redisStore.addConnection(connectionId, client, {
      username: connectionConfig.username,
      password: connectionConfig.password
    });
    
    redisStore.storeConnectionInfo(connectionId, {
      host: connectionConfig.host,
      port: connectionConfig.port.toString(),
      db: connectionConfig.db.toString(),
      name: connectionConfig.name || `${connectionConfig.host}:${connectionConfig.port}/${connectionConfig.db}`,
      connected_at: new Date().toISOString(),
      tls: connectionConfig.tls ? 'true' : 'false'
    });
    
    logRequest('connect', `Connected to Redis at ${connectionConfig.host}:${connectionConfig.port}/${connectionConfig.db}`);
    
    console.log(`Connection ${connectionId}: Added to registry`);
    debugConnections();
    
    return NextResponse.json({
      success: true,
      connection_id: connectionId,
      message: `Connected to Redis at ${connectionConfig.host}:${connectionConfig.port}/${connectionConfig.db}${connectionConfig.tls ? ' (TLS)' : ''}`,
    });
  } catch (error) {
    console.error('===== DEBUG: REDIS CONNECTION ERROR =====');
    console.error('Error details:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace available');
    
    if (error && typeof error === 'object' && 'client' in error) {
      console.log('Cleaning up failed Redis client');
      try {
        (error as { client: Redis }).client.disconnect();
      } catch (e) {
        console.error('Error during disconnect:', e);
      }
    }
    
    return NextResponse.json(
      {
        success: false,
        message: `Failed to connect: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 }
    );
  }
}
