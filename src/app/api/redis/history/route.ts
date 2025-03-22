import { NextRequest, NextResponse } from 'next/server';
import { logRequest, requestHistory } from '@/lib/request-logger';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const connectionId = searchParams.get('connection_id');
    
    logRequest('history', 'Retrieved request history', connectionId || undefined, req);
    
    if (connectionId) {
      const filteredHistory = requestHistory.filter(
        (req) => req.connection_id === connectionId
      );
      return NextResponse.json(filteredHistory);
    } else {
      return NextResponse.json(requestHistory);
    }
  } catch (error) {
    console.error('Error retrieving request history:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Error retrieving request history: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 400 }
    );
  }
}
