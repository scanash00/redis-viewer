import { NextRequest, NextResponse } from 'next/server';
import { redisStore } from '@/lib/redis-store';
import { logRequest } from '@/lib/request-logger';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const connectionId = searchParams.get('connection_id');
    
    logRequest('connection-info', `Get connection info`, connectionId || undefined, req);
    
    if (!connectionId) {
      return NextResponse.json(
        {
          success: false,
          message: 'Connection ID is required',
        }
      );
    }
    
    const connection = redisStore.getConnection(connectionId);
    if (!connection) {
      console.error(`Connection ${connectionId} not found in global store`);
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid connection ID',
        }
      );
    }
    
    return NextResponse.json({
      success: true,
      info: connection.info || {
        host: 'localhost',
        port: 6379,
        db: 0
      }
    });
  } catch (error) {
    console.error('Error in connection-info route:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Server error: ${error instanceof Error ? error.message : String(error)}`,
      }
    );
  }
}
