import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

export const requestHistory: Array<{
  id: string;
  timestamp: string;
  action: string;
  description: string;
  connection_id?: string;
  ip_address: string;
  is_external: boolean;
}> = [];

export function logRequest(action: string, description: string, connectionId?: string, req?: NextRequest) {
  let ipAddress = 'localhost';
  let isExternal = false;
  
  if (req) {
    const forwardedFor = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    const remoteIp = req.headers.get('x-real-ip') || 'localhost';
    
    if (forwardedFor) {
      ipAddress = forwardedFor.split(',')[0].trim();
    } else if (realIp) {
      ipAddress = realIp;
    } else {
      ipAddress = remoteIp;
    }
    
    isExternal = true;
    
    const referer = req.headers.get('referer') || '';
    const isDashboardRequest = referer.includes('/dashboard');
    
    if (isDashboardRequest && action === 'history') {
      isExternal = false;
    }
    
    console.log('===== REQUEST DETAILS =====');
    console.log('Action:', action);
    console.log('IP Address:', ipAddress);
    console.log('Referer:', referer);
    console.log('Is External:', isExternal);
    console.log('Headers:', JSON.stringify(Object.fromEntries([...req.headers.entries()]), null, 2));
  }
  
  const historyEntry = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    action,
    description,
    connection_id: connectionId,
    ip_address: ipAddress,
    is_external: isExternal
  };
  
  requestHistory.unshift(historyEntry);
  if (requestHistory.length > 100) {
    requestHistory.pop();
  }
  
  console.log(`Logged request: ${action} - ${description} - IP: ${ipAddress} - External: ${isExternal}`);
  
  return historyEntry;
}
