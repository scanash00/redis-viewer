import { NextRequest, NextResponse } from 'next/server';
import { logRequest } from '@/lib/request-logger';
import { redisStore } from '@/lib/redis-store';

const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
};

interface RouteParams {
  params: Promise<{
    key: string;
  }>;
}

export async function GET(req: NextRequest, context: RouteParams) {
  try {
    const params = await context.params;
    const key = decodeURIComponent(params.key);
    const { searchParams } = new URL(req.url);
    const connectionId = searchParams.get('connection_id');
    
    if (!connectionId) {
      return NextResponse.json(
        {
          success: false,
          message: 'Connection ID is required',
        },
        { 
          status: 400,
          headers: securityHeaders
        }
      );
    }
    
    console.log(`Fetching data for key: ${key}, connection: ${connectionId}`);
    
    const client = redisStore.getConnection(connectionId);
    if (!client) {
      console.error(`Connection ${connectionId} not found in global store`);
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid connection ID',
        },
        { 
          status: 400,
          headers: securityHeaders
        }
      );
    }
    
    const type = await client.type(key);
    
    if (type === 'none') {
      return NextResponse.json(
        {
          success: false,
          message: 'Key does not exist',
        },
        { 
          status: 404,
          headers: securityHeaders
        }
      );
    }
    
    logRequest('get_key', `Retrieved key: ${key} (${type})`, connectionId, req);
    
    let data;
    
    switch (type) {
      case 'string':
        data = await client.get(key);
        break;
      case 'list':
        data = await client.lrange(key, 0, -1);
        break;
      case 'set':
        data = await client.smembers(key);
        break;
      case 'zset':
        data = await client.zrange(key, 0, -1, 'WITHSCORES');
        break;
      case 'hash':
        data = await client.hgetall(key);
        break;
      default:
        return NextResponse.json(
          {
            success: false,
            message: `Unsupported data type: ${type}`,
          },
          { 
            status: 400,
            headers: securityHeaders
          }
        );
    }
    
    return NextResponse.json(
      {
        success: true,
        key,
        type,
        data,
      },
      { 
        headers: securityHeaders
      }
    );
  } catch (error) {
    console.error('Error retrieving key:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: `Error retrieving key: ${error instanceof Error ? error.message : String(error)}`,
      },
      { 
        status: 500,
        headers: securityHeaders
      }
    );
  }
}

export async function PUT(req: NextRequest, context: RouteParams) {
  try {
    const params = await context.params;
    const key = decodeURIComponent(params.key);
    const { searchParams } = new URL(req.url);
    const connectionId = searchParams.get('connection_id');
    const { type, data } = await req.json();
    
    if (!connectionId) {
      return NextResponse.json(
        {
          success: false,
          message: 'Connection ID is required',
        },
        { 
          status: 400,
          headers: securityHeaders
        }
      );
    }
    
    if (!type) {
      return NextResponse.json(
        {
          success: false,
          message: 'Type is required',
        },
        { 
          status: 400,
          headers: securityHeaders
        }
      );
    }
    
    if (data === undefined) {
      return NextResponse.json(
        {
          success: false,
          message: 'Data is required',
        },
        { 
          status: 400,
          headers: securityHeaders
        }
      );
    }
    
    const client = redisStore.getConnection(connectionId);
    if (!client) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid connection ID',
        },
        { 
          status: 400,
          headers: securityHeaders
        }
      );
    }
    
    logRequest('update_key', `Updated key: ${key}`, connectionId, req);
    
    switch (type) {
      case 'string':
        await client.set(key, data);
        break;
      case 'list':
        await client.del(key);
        if (Array.isArray(data) && data.length > 0) {
          await client.rpush(key, ...data);
        }
        break;
      case 'set':
        await client.del(key);
        if (Array.isArray(data) && data.length > 0) {
          await client.sadd(key, ...data);
        }
        break;
      case 'zset':
        return NextResponse.json(
          {
            success: false,
            message: 'Updating zset is not supported yet',
          },
          { 
            status: 400,
            headers: securityHeaders
          }
        );
      case 'hash':
        await client.del(key);
        if (typeof data === 'object' && data !== null) {
          for (const [field, value] of Object.entries(data)) {
            await client.hset(key, field, String(value));
          }
        }
        break;
      default:
        return NextResponse.json(
          {
            success: false,
            message: `Unsupported data type: ${type}`,
          },
          { 
            status: 400,
            headers: securityHeaders
          }
        );
    }
    
    return NextResponse.json(
      {
        success: true,
        message: 'Key updated successfully',
      },
      { 
        headers: securityHeaders
      }
    );
  } catch (error) {
    console.error('Error updating key:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: `Error updating key: ${error instanceof Error ? error.message : String(error)}`,
      },
      { 
        status: 500,
        headers: securityHeaders
      }
    );
  }
}

export async function DELETE(req: NextRequest, context: RouteParams) {
  try {
    const params = await context.params;
    const key = decodeURIComponent(params.key);
    const { searchParams } = new URL(req.url);
    const connectionId = searchParams.get('connection_id');
    
    if (!connectionId) {
      return NextResponse.json(
        {
          success: false,
          message: 'Connection ID is required',
        },
        { 
          status: 400,
          headers: securityHeaders
        }
      );
    }
    
    const client = redisStore.getConnection(connectionId);
    if (!client) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid connection ID',
        },
        { 
          status: 400,
          headers: securityHeaders
        }
      );
    }
    
    const exists = await client.exists(key);
    if (!exists) {
      return NextResponse.json(
        {
          success: false,
          message: 'Key does not exist',
        },
        { 
          status: 404,
          headers: securityHeaders
        }
      );
    }
    
    logRequest('delete_key', `Deleted key: ${key}`, connectionId, req);
    
    await client.del(key);
    
    return NextResponse.json(
      {
        success: true,
        message: 'Key deleted successfully',
      },
      { 
        headers: securityHeaders
      }
    );
  } catch (error) {
    console.error('Error deleting key:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: `Error deleting key: ${error instanceof Error ? error.message : String(error)}`,
      },
      { 
        status: 500,
        headers: securityHeaders
      }
    );
  }
}
