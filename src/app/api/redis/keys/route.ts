import { NextRequest, NextResponse } from 'next/server';
import { logRequest } from '@/lib/request-logger';
import { redisStore } from '@/lib/redis-store';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const connectionId = searchParams.get('connection_id');
    const pattern = searchParams.get('pattern') || '*';

    if (!connectionId) {
      return NextResponse.json(
        {
          success: false,
          message: 'Connection ID is required',
        },
        { status: 400 }
      );
    }

    logRequest('keys', `Fetched keys with pattern: ${pattern}`, connectionId, req);
    
    console.log('Requested connection ID:', connectionId);

    const client = redisStore.getConnection(connectionId);
    if (!client) {
      console.error(`Connection ${connectionId} not found in global store`);
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid connection ID',
        },
        { status: 400 }
      );
    }

    console.log(`Found connection ${connectionId} in global store`);

    try {
      console.log(`Fetching keys with pattern: ${pattern}, connection: ${connectionId}`);
      const keysPromise = client.keys(pattern);
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Redis operation timed out')), 5000);
      });
      
      const keys = await Promise.race([keysPromise, timeoutPromise]) as string[];
      console.log(`Successfully fetched ${keys.length} keys`);
      
      return NextResponse.json({
        success: true,
        keys,
      });
    } catch (error) {
      console.error(`Error fetching keys for connection ${connectionId}:`, error);
      
      if (error instanceof Error && 
          (error.message.includes('connection') || error.message.includes('timeout'))) {
        console.log(`Cleaning up failed connection ${connectionId}`);
        try {
          redisStore.removeConnection(connectionId);
        } catch (e) {
          console.error(`Error cleaning up connection ${connectionId}:`, e);
        }
      }
      
      return NextResponse.json(
        {
          success: false,
          message: `Error fetching keys: ${error instanceof Error ? error.message : String(error)}`,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in keys route:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Server error: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 }
    );
  }
}
