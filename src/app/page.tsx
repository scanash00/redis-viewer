"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { Database, Server, Terminal, Activity, Clock, Trash2, ExternalLink, ChevronRight, Key, Layers, RefreshCw, Shield } from "lucide-react";
import { RecentConnection, recentConnectionsManager } from "@/lib/recent-connections";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

interface ConnectionForm {
  host: string;
  port: string;
  db: string;
  password: string;
  username: string;
  name: string;
  tls: boolean;
  url: string;
}

export default function Home() {
  const router = useRouter();
  const [connectionForm, setConnectionForm] = useState<ConnectionForm>({
    host: "localhost",
    port: "6379",
    db: "0",
    password: "",
    username: "",
    name: "",
    tls: false,
    url: "",
  });
  const [connectionMethod, setConnectionMethod] = useState<"form" | "url">("form");
  const [loading, setLoading] = useState(false);
  const [recentConnections, setRecentConnections] = useState<RecentConnection[]>([]);
  const [activeConnections, setActiveConnections] = useState<string[]>([]);

  useEffect(() => {
    const connections = recentConnectionsManager.getRecentConnections();
    setRecentConnections(connections);
    
    const checkActiveConnections = async () => {
      try {
        const response = await fetch('/api/redis/active-connections');
        const data = await response.json();
        if (data.success) {
          setActiveConnections(data.connections || []);
        }
      } catch (error) {
        console.error('Error fetching active connections:', error);
      }
    };
    
    checkActiveConnections();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setConnectionForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleTabChange = (value: string) => {
    setConnectionMethod(value === "url" ? "url" : "form");
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const connectionData = connectionMethod === "url" 
        ? {
            url: connectionForm.url,
            name: connectionForm.name || connectionForm.url,
            host: "via-url",
            port: 6379,
            db: 0,
          }
        : {
            host: connectionForm.host,
            port: parseInt(connectionForm.port),
            db: parseInt(connectionForm.db),
            password: connectionForm.password || undefined,
            username: connectionForm.username || undefined,
            name: connectionForm.name || `${connectionForm.host}:${connectionForm.port}/${connectionForm.db}`,
            tls: connectionForm.tls,
          };

      const response = await fetch("/api/redis/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(connectionData),
      });

      const data = await response.json();

      if (data.success) {
        toast.success("Connected to Redis successfully!");
        
        recentConnectionsManager.addRecentConnection({
          id: data.connection_id,
          ...connectionData,
        });
        
        setRecentConnections(recentConnectionsManager.getRecentConnections());
        
        router.push(`/dashboard?connection_id=${data.connection_id}`);
      } else {
        toast.error(`Connection failed: ${data.message}`);
        setLoading(false);
      }
    } catch (error) {
      console.error("Error connecting to Redis:", error);
      toast.error("Failed to connect to Redis");
      setLoading(false);
    }
  };

  const connectToRecent = async (connection: RecentConnection) => {
    setLoading(true);

    try {
      const connectionData = connection.url 
        ? {
            url: connection.url,
            name: connection.name || connection.url,
          }
        : {
            host: connection.host,
            port: connection.port,
            db: connection.db,
            password: connection.password || undefined,
            username: connection.username || undefined,
            name: connection.name,
            tls: connection.tls,
          };

      const response = await fetch("/api/redis/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(connectionData),
      });

      const data = await response.json();

      if (data.success) {
        toast.success("Connected to Redis successfully!");
        
        recentConnectionsManager.addRecentConnection({
          ...connection,
          id: data.connection_id,
        });
        
        setRecentConnections(recentConnectionsManager.getRecentConnections());
        
        router.push(`/dashboard?connection_id=${data.connection_id}`);
      } else {
        toast.error(`Connection failed: ${data.message}`);
        setLoading(false);
      }
    } catch (error) {
      console.error("Error connecting to Redis:", error);
      toast.error("Failed to connect to Redis");
      setLoading(false);
    }
  };

  const removeRecentConnection = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updatedConnections = recentConnectionsManager.removeRecentConnection(id);
    setRecentConnections(updatedConnections || []);
    toast.success("Connection removed from history");
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const isConnectionActive = (connectionId: string) => {
    return activeConnections.includes(connectionId);
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-background to-muted/20">
      <header className="w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex h-14 items-center justify-between">
          <div className="flex items-center space-x-2">
            <Database className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">Redis Viewer</span>
          </div>
          
          {activeConnections.length > 0 && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Server className="h-4 w-4" />
                  Active Connections
                  <Badge variant="secondary" className="ml-1">{activeConnections.length}</Badge>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Active Connections</DialogTitle>
                  <DialogDescription>
                    Currently active Redis connections
                  </DialogDescription>
                </DialogHeader>
                <div className="max-h-[400px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Connection ID</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeConnections.map((connectionId) => {
                        const recentConnection = recentConnections.find(conn => conn.id === connectionId);
                        
                        return (
                          <TableRow key={connectionId}>
                            <TableCell className="font-medium">
                              {recentConnection ? 
                                (recentConnection.name || `${recentConnection.host}:${recentConnection.port}/${recentConnection.db}`) : 
                                connectionId.substring(0, 8) + '...'}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.push(`/dashboard?connection_id=${connectionId}`)}
                              >
                                Open
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <DialogFooter className="sm:justify-start">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      const closeButton = document.querySelector('[data-state="open"] button[data-state="closed"]') as HTMLButtonElement | null;
                      closeButton?.click();
                    }}
                  >
                    Close
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </header>

      <div className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 md:py-12">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
            <div className="lg:col-span-3 space-y-8">
              <div className="space-y-4">
                <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl bg-gradient-to-r from-primary to-primary/60 text-transparent bg-clip-text">
                  Redis Viewer
                </h1>
                <p className="text-xl text-muted-foreground max-w-3xl">
                  A modern web application for viewing and managing Redis databases with multiple connections, key browser, CLI, and request tracking.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Card className="border-primary/10 bg-background/60 backdrop-blur-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2">
                      <Key className="h-5 w-5 text-primary" />
                      Key Browser
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Browse, edit, and delete Redis keys with a user-friendly interface. Support for all Redis data types.
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="border-primary/10 bg-background/60 backdrop-blur-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2">
                      <Terminal className="h-5 w-5 text-primary" />
                      Redis CLI
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Execute Redis commands directly from the web interface with syntax highlighting and command history.
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="border-primary/10 bg-background/60 backdrop-blur-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2">
                      <Layers className="h-5 w-5 text-primary" />
                      Multiple Connections
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Connect to multiple Redis servers simultaneously and switch between them seamlessly.
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="border-primary/10 bg-background/60 backdrop-blur-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-primary" />
                      Request Tracking
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Track and monitor all Redis requests with detailed information about each operation.
                    </p>
                  </CardContent>
                </Card>
              </div>
              
              {recentConnections.length > 0 && (
                <Card className="border-primary/10 overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-primary" />
                        Recent Connections
                      </CardTitle>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="h-8 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          recentConnectionsManager.clearRecentConnections();
                          setRecentConnections([]);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Clear History
                      </Button>
                    </div>
                    <CardDescription>
                      Click on a connection to reconnect
                    </CardDescription>
                  </CardHeader>
                  
                  <div className="border-t">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Host</TableHead>
                          <TableHead>Last Connected</TableHead>
                          <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentConnections.map((connection) => (
                          <TableRow 
                            key={connection.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => connectToRecent(connection)}
                          >
                            <TableCell className="font-medium">
                              <div className="flex items-center">
                                {connection.name || `${connection.host}:${connection.port}/${connection.db}`}
                                {isConnectionActive(connection.id) && (
                                  <Badge variant="outline" className="ml-2 bg-green-50 text-green-700 border-green-200">
                                    Active
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {connection.host}:{connection.port}/{connection.db}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {formatTimestamp(connection.timestamp)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (isConnectionActive(connection.id)) {
                                            router.push(`/dashboard?connection_id=${connection.id}`);
                                          } else {
                                            connectToRecent(connection);
                                          }
                                        }}
                                      >
                                        <ExternalLink className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{isConnectionActive(connection.id) ? 'Open Dashboard' : 'Connect'}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                                        onClick={(e) => removeRecentConnection(e, connection.id)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Remove from history</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              )}
            </div>

            <div className="lg:col-span-2">
              <Card className="border-primary/10 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5 text-primary" />
                    Connect to Redis
                  </CardTitle>
                  <CardDescription>
                    Enter your Redis connection details below
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleConnect}>
                  <CardContent className="space-y-4">
                    <Tabs defaultValue="basic" className="w-full" onValueChange={handleTabChange}>
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="basic">Basic</TabsTrigger>
                        <TabsTrigger value="advanced">Advanced</TabsTrigger>
                        <TabsTrigger value="url">URL</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="basic" className="space-y-4 pt-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Connection Name (Optional)</Label>
                          <Input
                            id="name"
                            name="name"
                            placeholder="My Redis Server"
                            value={connectionForm.name}
                            onChange={handleInputChange}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="host">Host</Label>
                          <Input
                            id="host"
                            name="host"
                            placeholder="localhost"
                            value={connectionForm.host}
                            onChange={handleInputChange}
                            required={connectionMethod === "form"}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="port">Port</Label>
                            <Input
                              id="port"
                              name="port"
                              type="number"
                              placeholder="6379"
                              value={connectionForm.port}
                              onChange={handleInputChange}
                              required={connectionMethod === "form"}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="db">Database</Label>
                            <Input
                              id="db"
                              name="db"
                              type="number"
                              placeholder="0"
                              value={connectionForm.db}
                              onChange={handleInputChange}
                              required={connectionMethod === "form"}
                            />
                          </div>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="advanced" className="space-y-4 pt-4">
                        <div className="space-y-2">
                          <Label htmlFor="password" className="flex items-center gap-1">
                            <Shield className="h-4 w-4" />
                            Password (Optional)
                          </Label>
                          <Input
                            id="password"
                            name="password"
                            type="password"
                            placeholder="Password"
                            value={connectionForm.password}
                            onChange={handleInputChange}
                          />
                          <p className="text-xs text-muted-foreground">
                            Leave empty if authentication is not required
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="username" className="flex items-center gap-1">
                            <Shield className="h-4 w-4" />
                            Username (Optional)
                          </Label>
                          <Input
                            id="username"
                            name="username"
                            type="text"
                            placeholder="Username"
                            value={connectionForm.username}
                            onChange={handleInputChange}
                          />
                          <p className="text-xs text-muted-foreground">
                            Leave empty if authentication is not required
                          </p>
                        </div>
                        <div className="flex items-center space-x-2 pt-2">
                          <div className="flex h-5 items-center">
                            <input
                              id="tls"
                              name="tls"
                              type="checkbox"
                              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                              checked={connectionForm.tls}
                              onChange={(e) => setConnectionForm((prev) => ({ ...prev, tls: e.target.checked }))}
                            />
                          </div>
                          <div className="ml-2 text-sm">
                            <Label htmlFor="tls" className="flex items-center gap-1 cursor-pointer">
                              <Shield className="h-4 w-4" />
                              Enable TLS/SSL encryption (--tls)
                            </Label>
                            <p className="text-xs text-muted-foreground mt-1">
                              Use TLS for secure connections (equivalent to rediss:// protocol)
                            </p>
                          </div>
                        </div>
                        
                        <div className="rounded-md bg-muted p-3 border border-border">
                          <div className="flex items-start gap-2 text-sm">
                            <div className="mt-0.5 text-muted-foreground">
                              <RefreshCw className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">Connection string:</p>
                              <code className="rounded bg-background px-2 py-1 font-mono text-xs">
                                {connectionForm.tls ? 'rediss://' : 'redis://'}
                                {connectionForm.username ? `${connectionForm.username}` : ''}
                                {connectionForm.username && connectionForm.password ? ':' : ''}
                                {connectionForm.password ? '****' : ''}
                                {(connectionForm.username || connectionForm.password) ? '@' : ''}
                                {connectionForm.host}:{connectionForm.port}/{connectionForm.db}
                              </code>
                            </div>
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="url" className="space-y-4 pt-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Connection Name (Optional)</Label>
                          <Input
                            id="name"
                            name="name"
                            placeholder="My Redis Server"
                            value={connectionForm.name}
                            onChange={handleInputChange}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="url" className="flex items-center gap-1">
                            <ExternalLink className="h-4 w-4" />
                            Redis URL
                          </Label>
                          <Input
                            id="url"
                            name="url"
                            type="text"
                            placeholder="redis://username:password@localhost:6379/0"
                            value={connectionForm.url}
                            onChange={handleInputChange}
                            required={connectionMethod === "url"}
                          />
                          <p className="text-xs text-muted-foreground">
                            Enter a Redis connection URL (redis:// or rediss://)
                          </p>
                        </div>
                        
                        <div className="rounded-md bg-muted p-3 border border-border">
                          <div className="flex items-start gap-2 text-sm">
                            <div className="mt-0.5 text-muted-foreground">
                              <RefreshCw className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">URL Format Examples</p>
                              <div className="mt-2 grid grid-cols-1 gap-2">
                                <code className="rounded bg-background px-2 py-1 font-mono text-xs">redis://localhost:6379/0</code>
                                <code className="rounded bg-background px-2 py-1 font-mono text-xs">rediss://localhost:6379/0</code>
                                <code className="rounded bg-background px-2 py-1 font-mono text-xs">redis://user:pass@localhost:6379/0</code>
                                <code className="rounded bg-background px-2 py-1 font-mono text-xs">rediss://:pass@upstash.io:6379/0</code>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="rounded-md bg-muted/50 p-3 border border-border">
                          <div className="flex items-start gap-2">
                            <div className="mt-0.5 text-primary">
                              <Shield className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">Upstash Redis Note</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Upstash Redis requires TLS/SSL. The application will automatically enable TLS for any connection to an upstash.io host.
                              </p>
                            </div>
                          </div>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                  <CardFooter className="pt-6">
                    <Button 
                      type="submit" 
                      className="w-full gap-2" 
                      disabled={loading}
                      size="lg"
                    >
                      {loading ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          Connect
                          <ChevronRight className="h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </div>
          </div>
        </div>
      </div>
      
      <footer className="w-full border-t py-6 md:py-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:flex md:items-center md:justify-between md:h-14">
          <div className="flex justify-center md:justify-start space-x-6 md:order-2">
            <span className="text-sm text-muted-foreground">
              {activeConnections.length} active connection{activeConnections.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="mt-4 md:mt-0 md:order-1 flex justify-center md:justify-start">
            <p className="text-center text-sm text-muted-foreground">
              Redis Viewer made by <a href="https://scanash.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">scanash</a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
