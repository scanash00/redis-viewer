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

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { command, connectionId } = await req.json();
    
    if (!command) {
      return NextResponse.json(
        {
          success: false,
          message: 'Command is required',
        },
        { 
          status: 400,
          headers: securityHeaders
        }
      );
    }
    
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
    
    logRequest('cli', `Executed command: ${command}`, connectionId, req);
    
    const commandParts = command.split(' ').filter(Boolean);
    const commandName = commandParts[0].toLowerCase();
    
    const blockedCommands = ['flushall', 'flushdb', 'config', 'shutdown', 'save', 'bgsave', 'lastsave', 'monitor'];
    if (blockedCommands.includes(commandName)) {
      return NextResponse.json(
        {
          success: false,
          message: `Command '${commandName}' is not allowed for security reasons`,
        },
        { 
          status: 403,
          headers: securityHeaders
        }
      );
    }
    
    let result;
    try {
      result = await client.call(commandName, ...commandParts.slice(1));
    } catch (error) {
      console.error(`Error executing command ${commandName}:`, error);
      return NextResponse.json(
        {
          success: false,
          message: `Error executing command: ${error instanceof Error ? error.message : String(error)}`,
        },
        { 
          status: 500,
          headers: securityHeaders
        }
      );
    }
    
    let formattedResult: string | string[];
    if (Array.isArray(result)) {
      formattedResult = result.map(item => item?.toString() || '(nil)');
    } else if (result === null) {
      formattedResult = '(nil)';
    } else {
      formattedResult = String(result);
    }
    
    return NextResponse.json(
      {
        success: true,
        result: formattedResult,
      },
      { 
        headers: securityHeaders
      }
    );
  } catch (error) {
    console.error('Error executing Redis command:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: `Error executing command: ${error instanceof Error ? error.message : String(error)}`,
      },
      { 
        status: 500,
        headers: securityHeaders
      }
    );
  }
}
