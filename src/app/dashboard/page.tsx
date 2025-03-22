"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Database, Terminal, Activity, Search, Key, Trash2, RefreshCw, Save } from "lucide-react";

interface RedisKey {
  name: string;
  type: string;
  data: unknown;
}

interface RequestHistoryItem {
  id: string;
  timestamp: string;
  action: string;
  description: string;
  is_external: boolean;
  ip_address: string;
}

interface ConnectionInfo {
  host: string;
  port: number;
  db: number;
  password?: string;
}

function DashboardLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>Loading Dashboard...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center">
            <RefreshCw className="h-8 w-8 animate-spin" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const connectionId = searchParams.get("connection_id");
  
  const [keys, setKeys] = useState<string[]>([]);
  const [searchPattern, setSearchPattern] = useState("*");
  const [selectedKey, setSelectedKey] = useState<RedisKey | null>(null);
  const [editedData, setEditedData] = useState<string>("");
  const [cliCommand, setCliCommand] = useState("");
  const [cliResult, setCliResult] = useState<string | null>(null);
  const [requestHistory, setRequestHistory] = useState<RequestHistoryItem[]>([]);
  const [loading, setLoading] = useState({
    keys: false,
    keyData: false,
    cli: false,
    reconnecting: false,
    history: false,
  });
  const [connectionInfo] = useState<ConnectionInfo | null>(null);
  const [redisVersion, setRedisVersion] = useState<string>("");

  const fetchKeys = useCallback(async () => {
    if (!connectionId) return;
    
    setLoading(prev => ({ ...prev, keys: true }));
    try {
      const response = await fetch(`/api/redis/keys?connection_id=${connectionId}&pattern=${searchPattern}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error(`Failed to fetch keys: ${errorData.message}`);
        toast.error(`Failed to fetch keys: ${errorData.message}`);
        return;
      }
      
      const data = await response.json();
      
      if (data.success) {
        setKeys(data.keys);
      } else {
        console.error(`Failed to fetch keys: ${data.message}`);
        toast.error(`Failed to fetch keys: ${data.message}`);
      }
    } catch {
      console.error("Error fetching keys:");
      toast.error("Failed to fetch keys");
    } finally {
      setLoading(prev => ({ ...prev, keys: false }));
    }
  }, [connectionId, searchPattern]);

  const fetchRequestHistory = useCallback(async () => {
    if (!connectionId) return;
    
    setLoading(prev => ({ ...prev, history: true }));
    try {
      const response = await fetch(`/api/redis/history?connection_id=${connectionId}&t=${Date.now()}`);
      const data = await response.json();
      setRequestHistory(data);
    } catch {
      console.error("Error fetching request history:");
      toast.error("Failed to fetch request history");
    } finally {
      setLoading(prev => ({ ...prev, history: false }));
    }
  }, [connectionId]);

  const fetchRedisInfo = useCallback(async () => {
    if (!connectionId) return;
    
    try {
      const response = await fetch(`/api/redis/cli?connection_id=${connectionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          command: 'INFO server',
        }),
      });
      
      const data = await response.json();
      
      if (data.success && data.result) {
        const infoLines = data.result.toString().split('\n');
        const versionLine = infoLines.find((line: string) => line.startsWith('redis_version:'));
        if (versionLine) {
          const version = versionLine.split(':')[1].trim();
          setRedisVersion(version);
        }
      }
    } catch {
      console.error("Error fetching Redis info:");
    }
  }, [connectionId]);

  useEffect(() => {
    if (!connectionId) {
      toast.error("No connection ID provided");
      return;
    }

    fetchKeys();
    fetchRequestHistory();
    fetchRedisInfo();
    
    const historyInterval = setInterval(fetchRequestHistory, 5000);
    
    return () => {
      clearInterval(historyInterval);
    };
  }, [connectionId, searchPattern, fetchKeys, fetchRequestHistory, fetchRedisInfo]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const checkConnection = useCallback(async () => {
    if (!connectionId) return;
    
    try {
      const response = await fetch(`/api/redis/history?connection_id=${connectionId}`);
      
      if (!response.ok) {
        toast.error("Connection to Redis lost. Please reconnect.");
        return false;
      }
      
      return true;
    } catch {
      console.error("Error checking connection:");
      toast.error("Connection to Redis lost. Please reconnect.");
      return false;
    }
  }, [connectionId]);

  const fetchKeyData = useCallback(async (keyName: string) => {
    if (!connectionId) return;
    
    setLoading(prev => ({ ...prev, keyData: true }));
    try {
      const response = await fetch(`/api/redis/key/${encodeURIComponent(keyName)}?connection_id=${connectionId}`);
      const data = await response.json();
      
      if (data.success) {
        setSelectedKey({
          name: data.key,
          type: data.type,
          data: data.data,
        });
        
        if (data.type === 'string') {
          setEditedData(data.data || "");
        } else {
          setEditedData(JSON.stringify(data.data, null, 2));
        }
      } else {
        toast.error(`Failed to fetch key data: ${data.message}`);
      }
    } catch {
      console.error("Error fetching key data:");
      toast.error("Failed to fetch key data");
    } finally {
      setLoading(prev => ({ ...prev, keyData: false }));
    }
  }, [connectionId]);

  const saveKeyData = useCallback(async () => {
    if (!connectionId || !selectedKey) return;
    
    try {
      let parsedData;
      
      if (selectedKey.type === 'string') {
        parsedData = editedData;
      } else {
        try {
          parsedData = JSON.parse(editedData);
        } catch {
          toast.error("Invalid JSON format");
          return;
        }
      }
      
      const response = await fetch(`/api/redis/key/${encodeURIComponent(selectedKey.name)}?connection_id=${connectionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: parsedData,
          type: selectedKey.type,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success("Key updated successfully");
        fetchKeyData(selectedKey.name);
      } else {
        toast.error(`Failed to update key: ${data.message}`);
      }
    } catch {
      console.error("Error updating key:");
      toast.error("Failed to update key");
    }
  }, [connectionId, selectedKey, editedData, fetchKeyData]);

  const deleteKey = useCallback(async (keyName: string) => {
    if (!connectionId) return;
    
    if (!confirm(`Are you sure you want to delete the key "${keyName}"?`)) {
      return;
    }
    
    try {
      const response = await fetch(`/api/redis/key/${encodeURIComponent(keyName)}?connection_id=${connectionId}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success(`Key "${keyName}" deleted successfully`);
        
        if (selectedKey && selectedKey.name === keyName) {
          setSelectedKey(null);
          setEditedData("");
        }
        
        fetchKeys();
      } else {
        toast.error(`Failed to delete key: ${data.message}`);
      }
    } catch {
      console.error("Error deleting key:");
      toast.error("Failed to delete key");
    }
  }, [connectionId, selectedKey, fetchKeys]);

  const executeCliCommand = useCallback(async () => {
    if (!connectionId || !cliCommand.trim()) return;
    
    setLoading(prev => ({ ...prev, cli: true }));
    try {
      if (cliCommand.trim().toLowerCase() === 'clear') {
        setCliResult(null);
        setCliCommand("");
        setLoading(prev => ({ ...prev, cli: false }));
        return;
      }
      
      const prompt = `redis> `;
      
      setCliResult(prev => {
        const separator = prev ? '\n' : '';
        return `${prev}${separator}${prompt}${cliCommand}`;
      });
      
      const response = await fetch(`/api/redis/cli`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          connectionId: connectionId,
          command: cliCommand,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        if (data.clear) {
          setCliResult(null);
          setCliCommand("");
          setLoading(prev => ({ ...prev, cli: false }));
          return;
        }
        
        let formattedResult = data.result;
        
        if (Array.isArray(data.result)) {
          formattedResult = data.result.map((item: unknown, index: number) => {
            return `${index + 1}) "${String(item)}"`;
          }).join('\n');
        }
        
        setCliResult(prev => {
          return `${prev}\n${formattedResult}`;
        });
        
        setCliCommand("");
        
        const cliResultElement = document.getElementById('cli-result');
        if (cliResultElement) {
          setTimeout(() => {
            cliResultElement.scrollTop = cliResultElement.scrollHeight;
          }, 100);
        }
      } else {
        setCliResult(prev => {
          return `${prev}\n${data.message}`;
        });
      }
    } catch {
      console.error("Error executing CLI command:");
      
      setCliResult(prev => {
        return `${prev}\nERR execution error`;
      });
    } finally {
      setLoading(prev => ({ ...prev, cli: false }));
    }
  }, [connectionId, cliCommand]);

  useEffect(() => {
    if (connectionId && redisVersion && connectionInfo) {
      setCliResult(`Redis ${redisVersion} (${connectionInfo.host}:${connectionInfo.port})
Type "help" for help, "clear" to clear the screen.
`);
    }
  }, [connectionId, redisVersion, connectionInfo]);

  if (!connectionId) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle>No Connection</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4">No Redis connection ID provided.</p>
            <Button asChild>
              <Link href="/">Go Back to Connect</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex h-14 items-center">
          <div className="flex items-center space-x-2">
            <Database className="h-6 w-6" />
            <Link href="/" className="font-bold">Redis Viewer</Link>
          </div>
          <div className="flex flex-1 items-center justify-end space-x-2">
            <nav className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground hidden md:inline-block">Connection ID: {connectionId.substring(0, 8)}...</span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchKeys}
                disabled={loading.keys}
              >
                {loading.keys ? 'Loading Keys...' : 'Reload Keys'}
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/">New Connection</Link>
              </Button>
            </nav>
          </div>
        </div>
      </header>
      
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <Tabs defaultValue="browser" className="w-full">
            <TabsList className="mb-4 w-full justify-start overflow-x-auto">
              <TabsTrigger value="browser" className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                <span>Browser</span>
              </TabsTrigger>
              <TabsTrigger value="cli" className="flex items-center gap-2">
                <Terminal className="h-4 w-4" />
                <span>Redis CLI</span>
              </TabsTrigger>
              <TabsTrigger value="tracking" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                <span>Request Tracking</span>
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="browser" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-[minmax(250px,300px)_1fr] gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Search keys (e.g., user:*)"
                      value={searchPattern}
                      onChange={(e) => setSearchPattern(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && fetchKeys()}
                      className="text-sm"
                    />
                    <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={fetchKeys}
                      disabled={loading.keys}
                      className="flex-shrink-0"
                    >
                      {loading.keys ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>
                  
                  <div className="border rounded-md h-[calc(100vh-180px)] overflow-y-auto">
                    {keys.length === 0 ? (
                      <div className="p-4 text-center text-muted-foreground">
                        {loading.keys ? (
                          "Loading keys..."
                        ) : (
                          <div>
                            <p className="mb-2">No keys found</p>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={fetchKeys}
                              disabled={loading.keys}
                            >
                              Load Keys
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <ul className="divide-y">
                        {keys.map((key) => (
                          <li key={key} className="hover:bg-muted/50 flex items-center justify-between">
                            <button
                              className="text-sm flex-1 text-left truncate px-2 py-1.5 rounded hover:bg-muted w-full"
                              onClick={() => fetchKeyData(key)}
                            >
                              <span className="flex items-center gap-2">
                                <Key className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{key}</span>
                              </span>
                            </button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 flex-shrink-0"
                              onClick={() => deleteKey(key)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2">
                  {selectedKey ? (
                    <>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <h2 className="text-lg font-semibold flex items-center gap-2 truncate">
                          <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs uppercase">{selectedKey.type}</span>
                          <span className="truncate max-w-[200px] md:max-w-[400px]">{selectedKey.name}</span>
                        </h2>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => fetchKeyData(selectedKey.name)}
                            disabled={loading.keyData}
                          >
                            {loading.keyData ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                            Refresh
                          </Button>
                          <Button 
                            variant="default" 
                            size="sm" 
                            onClick={saveKeyData}
                          >
                            <Save className="h-4 w-4 mr-2" />
                            Save
                          </Button>
                        </div>
                      </div>
                      
                      <Textarea
                        className="font-mono text-sm h-[calc(100vh-200px)] resize-none"
                        value={editedData}
                        onChange={(e) => setEditedData(e.target.value)}
                        placeholder="Key data"
                      />
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-[calc(100vh-180px)] border rounded-md">
                      <div className="text-center text-muted-foreground p-4">
                        <Database className="h-12 w-12 mx-auto mb-4 opacity-20" />
                        <p>Select a key to view and edit its content</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="cli" className="space-y-4">
              <div className="mt-6">
                <h2 className="text-xl font-bold mb-2">Redis CLI</h2>
                <div 
                  id="cli-result" 
                  className="font-mono text-sm whitespace-pre-wrap"
                  style={{ 
                    backgroundColor: '#1e1e1e', 
                    color: '#f0f0f0',
                    minHeight: '400px',
                    maxHeight: '400px',
                    padding: '12px',
                    overflow: 'auto',
                    borderColor: '#333'
                  }}
                >
                  {cliResult || ''}
                  <div className="flex items-start">
                    <span className="text-gray-400 mr-1">redis&gt;</span>
                    <input
                      type="text"
                      value={cliCommand}
                      onChange={(e) => setCliCommand(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          executeCliCommand();
                        }
                      }}
                      placeholder="Type a command..."
                      className="bg-transparent border-none outline-none flex-1 font-mono text-sm"
                      style={{ 
                        color: '#f0f0f0',
                        caretColor: '#f0f0f0'
                      }}
                      disabled={loading.cli}
                      autoFocus
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="tracking" className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Request History</h2>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={fetchRequestHistory}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
              
              <div className="border rounded-md overflow-hidden overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Timestamp</TableHead>
                      <TableHead className="w-[100px]">Action</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requestHistory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center h-32 text-muted-foreground">
                          <Activity className="h-12 w-12 mx-auto mb-4 opacity-20" />
                          <p>No request history available</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      requestHistory.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-xs whitespace-nowrap">
                            {new Date(item.timestamp).toLocaleString()}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs uppercase">
                              {item.action}
                            </span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {item.is_external ? (
                              <div className="flex items-center">
                                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 border border-yellow-200 rounded text-xs uppercase font-semibold">
                                  External
                                </span>
                                <span className="ml-2 text-xs text-gray-500">{item.ip_address}</span>
                              </div>
                            ) : (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 border border-blue-200 rounded text-xs uppercase font-semibold">
                                Internal
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[300px] truncate md:max-w-none">
                            {item.description}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardContent />
    </Suspense>
  );
}
