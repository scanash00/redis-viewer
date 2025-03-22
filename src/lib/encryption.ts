import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'redis-viewer-encryption-key-32chars'; // Must be 32 bytes (32 chars)
const ENCRYPTION_IV = process.env.ENCRYPTION_IV || crypto.randomBytes(16); // 16 bytes for AES
const ENCRYPTION_ALGORITHM = 'aes-256-cbc';

export function encrypt(text: string): string {
  if (!text) return '';
  
  try {
    const cipher = crypto.createCipheriv(
      ENCRYPTION_ALGORITHM, 
      Buffer.from(ENCRYPTION_KEY), 
      typeof ENCRYPTION_IV === 'string' ? Buffer.from(ENCRYPTION_IV, 'hex') : ENCRYPTION_IV
    );
    
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    return '';
  }
}

export function decrypt(encryptedText: string): string {
  if (!encryptedText) return '';
  
  try {
    const decipher = crypto.createDecipheriv(
      ENCRYPTION_ALGORITHM, 
      Buffer.from(ENCRYPTION_KEY), 
      typeof ENCRYPTION_IV === 'string' ? Buffer.from(ENCRYPTION_IV, 'hex') : ENCRYPTION_IV
    );
    
    let decrypted = decipher.update(encryptedText, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    return '';
  }
}

export function storeSecureData(connectionId: string, data: Record<string, string>): void {
  if (typeof window !== 'undefined') {
    const encryptedData = encrypt(JSON.stringify(data));
    sessionStorage.setItem(`secure_${connectionId}`, encryptedData);
  } else {
    if (!global.secureStore) {
      global.secureStore = {};
    }
    global.secureStore[connectionId] = data;
  }
}

export function getSecureData(connectionId: string): Record<string, string> | null {
  if (typeof window !== 'undefined') {
    const encryptedData = sessionStorage.getItem(`secure_${connectionId}`);
    if (!encryptedData) return null;
    
    try {
      return JSON.parse(decrypt(encryptedData));
    } catch (error) {
      console.error('Error parsing secure data:', error);
      return null;
    }
  } else {
    if (!global.secureStore || !global.secureStore[connectionId]) {
      return null;
    }
    return global.secureStore[connectionId];
  }
}

export function removeSecureData(connectionId: string): void {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(`secure_${connectionId}`);
  } else {
    if (global.secureStore && global.secureStore[connectionId]) {
      delete global.secureStore[connectionId];
    }
  }
}

declare global {
  // eslint-disable-next-line no-var
  var secureStore: Record<string, Record<string, string>> | undefined;
}
