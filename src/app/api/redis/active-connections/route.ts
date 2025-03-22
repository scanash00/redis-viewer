import { NextResponse } from 'next/server';
import { redisStore } from '@/lib/redis-store';

export async function GET() {
  try {
    const connectionIds = redisStore.getConnectionIds();
    
    return NextResponse.json({
      success: true,
      connections: connectionIds,
      count: connectionIds.length
    });
  } catch (error) {
    console.error('Error fetching active connections:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Failed to fetch active connections: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}
