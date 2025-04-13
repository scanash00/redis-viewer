# 🧠 Redis Viewer

A web app to manage multiple Redis database connections with:

- 🔑 **Key Browser**  
- 💻 **Redis CLI**  
- 🌐 **Multiple Connections Support**  
- 📊 **Request Tracking**
- 🔒 **TLS Support**


## 🚀 Deploying

You’ll need **Node.js** installed (preferably the latest version).

1. Install dependencies  
   ```bash
   npm install
   ```

2. Build the application  
   ```bash
   npm run build
   ```

3. Start the server  
   ```bash
   npm run start
   ```

---

## 🔒 Important Note

This project is currently designed **only for private use**.  
**Do NOT deploy it publicly** without adding proper authentication — all your Redis connections would be exposed to anyone with access to the URL.

If you'd like to expose this app publicly, make sure to use Simple Auth (Traefik) or add your own authentication, only expose the app publicly if you know what you are doing!!!

---

## ✅ Features at a Glance

| Feature             | Description                                    |
|---------------------|------------------------------------------------|
| Key Browser         | Navigate and view Redis keys in real-time     |
| Redis CLI           | Full command-line interface to Redis          |
| Multi-DB Support    | Manage multiple Redis connections easily      |
| Request Tracking    | Monitor and log Redis commands         
| TLS Support         | Use TLS in your redis connections using rediss:// 

---

## 🧪 Development

To start in development mode:

```bash
npm run dev
```

Hot reloading and better error tracing included.

---
