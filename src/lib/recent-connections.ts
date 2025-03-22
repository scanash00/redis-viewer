export interface RecentConnection {
  id: string;
  host: string;
  port: number;
  db: number;
  password?: string;
  username?: string;
  name?: string;
  tls?: boolean;
  url?: string;
  timestamp: number;
  lastConnected: number;
}

const RECENT_CONNECTIONS_KEY = 'redis-viewer-recent-connections';
const MAX_RECENT_CONNECTIONS = 10;

export const recentConnectionsManager = {
  getRecentConnections: (): RecentConnection[] => {
    if (typeof window === 'undefined') return [];
    
    try {
      const storedConnections = localStorage.getItem(RECENT_CONNECTIONS_KEY);
      if (!storedConnections) return [];
      
      return JSON.parse(storedConnections);
    } catch (error) {
      console.error('Error retrieving recent connections:', error);
      return [];
    }
  },
  
  getConnections: async (): Promise<RecentConnection[]> => {
    return recentConnectionsManager.getRecentConnections();
  },
  
  addRecentConnection: (connection: Omit<RecentConnection, 'timestamp' | 'lastConnected'>) => {
    if (typeof window === 'undefined') return;
    
    try {
      const recentConnections = recentConnectionsManager.getRecentConnections();
      
      const existingIndex = recentConnections.findIndex(c => 
        c.id === connection.id || 
        (c.host === connection.host && 
         c.port === connection.port && 
         c.db === connection.db)
      );
      
      if (existingIndex !== -1) {
        recentConnections.splice(existingIndex, 1);
      }
      
      const now = Date.now();
      const newConnection: RecentConnection = {
        ...connection,
        timestamp: now,
        lastConnected: now
      };
      
      const updatedConnections = [
        newConnection,
        ...recentConnections
      ].slice(0, MAX_RECENT_CONNECTIONS);
      
      localStorage.setItem(RECENT_CONNECTIONS_KEY, JSON.stringify(updatedConnections));
      
      return updatedConnections;
    } catch (error) {
      console.error('Error adding recent connection:', error);
    }
  },
  
  removeRecentConnection: (connectionId: string) => {
    if (typeof window === 'undefined') return;
    
    try {
      const recentConnections = recentConnectionsManager.getRecentConnections();
      const updatedConnections = recentConnections.filter(c => c.id !== connectionId);
      
      localStorage.setItem(RECENT_CONNECTIONS_KEY, JSON.stringify(updatedConnections));
      
      return updatedConnections;
    } catch (error) {
      console.error('Error removing recent connection:', error);
    }
  },
  
  clearRecentConnections: () => {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.removeItem(RECENT_CONNECTIONS_KEY);
    } catch (error) {
      console.error('Error clearing recent connections:', error);
    }
  }
};
