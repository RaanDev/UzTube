import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import multer from "multer";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { fileURLToPath } from "url";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("database.sqlite");
db.pragma('foreign_keys = ON');
const JWT_SECRET = "uztube-secret-key-123";

// Database Initialization
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    avatar TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    videoUrl TEXT NOT NULL,
    thumbnailUrl TEXT NOT NULL,
    userId INTEGER NOT NULL,
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    dislikes INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    videoId INTEGER NOT NULL,
    userId INTEGER NOT NULL,
    text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (videoId) REFERENCES videos(id) ON DELETE CASCADE,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS video_likes (
    userId INTEGER NOT NULL,
    videoId INTEGER NOT NULL,
    PRIMARY KEY (userId, videoId),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (videoId) REFERENCES videos(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS video_dislikes (
    userId INTEGER NOT NULL,
    videoId INTEGER NOT NULL,
    PRIMARY KEY (userId, videoId),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (videoId) REFERENCES videos(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    followerId INTEGER NOT NULL,
    followingId INTEGER NOT NULL,
    PRIMARY KEY (followerId, followingId),
    FOREIGN KEY (followerId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (followingId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    videoId INTEGER,
    isRead INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (videoId) REFERENCES videos(id) ON DELETE CASCADE
  );
`);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 2048 * 1024 * 1024, // 2GB limit
  }
});

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });
  const PORT = 3000;

  // WebSocket connection management
  const clients = new Map<number, WebSocket>();

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const token = url.searchParams.get("token");

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        clients.set(decoded.id, ws);
        
        ws.on("close", () => {
          clients.delete(decoded.id);
        });
      } catch (err) {
        ws.close();
      }
    } else {
      ws.close();
    }
  });

  const sendNotification = (userId: number, notification: any) => {
    const client = clients.get(userId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(notification));
    }
  };

  app.use(express.json({ limit: '2gb' }));
  app.use(express.urlencoded({ limit: '2gb', extended: true }));
  app.use("/uploads", express.static(path.join(__dirname, "uploads"), {
    setHeaders: (res) => {
      res.set("Access-Control-Allow-Origin", "*");
    }
  }));

  // Auth Middleware
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) return res.status(401).json({ error: "Kirish talab qilinadi" });

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.status(403).json({ error: "Yaroqsiz token" });
      req.user = user;
      next();
    });
  };

  // --- API Routes ---

  // Auth
  app.post("/api/auth/register", async (req, res) => {
    const { name, email, password } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const info = db.prepare("INSERT INTO users (name, email, password) VALUES (?, ?, ?)").run(name, email, hashedPassword);
      const token = jwt.sign({ id: info.lastInsertRowid, name, email }, JWT_SECRET);
      res.json({ token, user: { id: info.lastInsertRowid, name, email } });
    } catch (error: any) {
      res.status(400).json({ error: "Email allaqachon mavjud yoki xato ma'lumot" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    const user: any = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Email yoki parol xato" });
    }
    const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar } });
  });

  app.get("/api/auth/me", authenticateToken, (req: any, res) => {
    const user: any = db.prepare("SELECT id, name, email, avatar FROM users WHERE id = ?").get(req.user.id);
    res.json(user);
  });

  // Videos
  app.get("/api/videos", (req, res) => {
    const { q } = req.query;
    let videos;
    if (q) {
      videos = db.prepare(`
        SELECT v.*, u.name as userName, u.avatar as userAvatar 
        FROM videos v 
        JOIN users u ON v.userId = u.id 
        WHERE v.title LIKE ? OR v.description LIKE ?
        ORDER BY v.created_at DESC
      `).all(`%${q}%`, `%${q}%`);
    } else {
      videos = db.prepare(`
        SELECT v.*, u.name as userName, u.avatar as userAvatar 
        FROM videos v 
        JOIN users u ON v.userId = u.id 
        ORDER BY v.created_at DESC
      `).all();
    }
    res.json(videos);
  });

  app.get("/api/videos/:id", (req, res) => {
    const video: any = db.prepare(`
      SELECT v.*, u.name as userName, u.avatar as userAvatar 
      FROM videos v 
      JOIN users u ON v.userId = u.id 
      WHERE v.id = ?
    `).get(req.params.id);
    
    if (!video) return res.status(404).json({ error: "Video topilmadi" });
    
    // Increment views
    db.prepare("UPDATE videos SET views = views + 1 WHERE id = ?").run(req.params.id);
    video.views += 1;

    res.json(video);
  });

  app.post("/api/videos", authenticateToken, upload.fields([{ name: 'video', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]), (req: any, res) => {
    const { title, description } = req.body;
    const videoFile = req.files['video']?.[0];
    const thumbnailFile = req.files['thumbnail']?.[0];

    if (!videoFile || !thumbnailFile) {
      return res.status(400).json({ error: "Video va muqova (thumbnail) yuklanishi shart" });
    }

    const videoUrl = `/uploads/${videoFile.filename}`;
    const thumbnailUrl = `/uploads/${thumbnailFile.filename}`;

    const info = db.prepare("INSERT INTO videos (title, description, videoUrl, thumbnailUrl, userId) VALUES (?, ?, ?, ?, ?)")
      .run(title, description, videoUrl, thumbnailUrl, req.user.id);

    const videoId = info.lastInsertRowid;
    const user = db.prepare("SELECT name FROM users WHERE id = ?").get(req.user.id) as any;

    // Create notifications for subscribers
    const subscribers = db.prepare("SELECT followerId FROM subscriptions WHERE followingId = ?").all(req.user.id) as any[];
    
    subscribers.forEach(sub => {
      const message = `${user.name} yangi video joyladi: ${title}`;
      const notificationResult = db.prepare(`
        INSERT INTO notifications (userId, type, message, videoId) 
        VALUES (?, ?, ?, ?)
      `).run(sub.followerId, 'new_video', message, videoId);

      const notification = {
        id: notificationResult.lastInsertRowid,
        userId: sub.followerId,
        type: 'new_video',
        message,
        videoId,
        isRead: 0,
        created_at: new Date().toISOString()
      };

      sendNotification(sub.followerId, notification);
    });

    res.json({ id: videoId, title, videoUrl, thumbnailUrl });
  });

  app.put("/api/videos/:id", authenticateToken, (req: any, res) => {
    const { title, description } = req.body;
    const videoId = req.params.id;
    const userId = req.user.id;

    const video: any = db.prepare("SELECT * FROM videos WHERE id = ?").get(videoId);
    if (!video) return res.status(404).json({ error: "Video topilmadi" });
    if (video.userId !== userId) return res.status(403).json({ error: "Sizda ushbu videoni tahrirlash huquqi yo'q" });

    db.prepare("UPDATE videos SET title = ?, description = ? WHERE id = ?").run(title, description, videoId);
    res.json({ message: "Video muvaffaqiyatli yangilandi" });
  });

  app.delete("/api/videos/:id", authenticateToken, (req: any, res) => {
    const videoId = req.params.id;
    const userId = req.user.id;

    console.log(`Deleting video: ${videoId} by user: ${userId}`);

    try {
      const video: any = db.prepare("SELECT * FROM videos WHERE id = ?").get(videoId);
      
      if (!video) {
        console.log("Video not found");
        return res.status(404).json({ error: "Video topilmadi" });
      }
      
      if (video.userId !== userId) {
        console.log(`Unauthorized delete attempt: video owner is ${video.userId}, requester is ${userId}`);
        return res.status(403).json({ error: "Sizda ushbu videoni o'chirish huquqi yo'q" });
      }

      // Delete physical files
      try {
        const videoPath = path.join(__dirname, video.videoUrl.startsWith('/') ? video.videoUrl.substring(1) : video.videoUrl);
        const thumbPath = path.join(__dirname, video.thumbnailUrl.startsWith('/') ? video.thumbnailUrl.substring(1) : video.thumbnailUrl);
        
        if (fs.existsSync(videoPath)) {
          fs.unlinkSync(videoPath);
          console.log(`Deleted video file: ${videoPath}`);
        }
        if (fs.existsSync(thumbPath)) {
          fs.unlinkSync(thumbPath);
          console.log(`Deleted thumbnail file: ${thumbPath}`);
        }
      } catch (fileErr) {
        console.error("Error deleting files:", fileErr);
        // Continue with DB deletion even if file deletion fails
      }

      // Delete related data first (though CASCADE should handle it, we do it explicitly for safety)
      db.prepare("DELETE FROM comments WHERE videoId = ?").run(videoId);
      db.prepare("DELETE FROM video_likes WHERE videoId = ?").run(videoId);
      db.prepare("DELETE FROM video_dislikes WHERE videoId = ?").run(videoId);
      db.prepare("DELETE FROM notifications WHERE videoId = ?").run(videoId);
      db.prepare("DELETE FROM videos WHERE id = ?").run(videoId);

      console.log("Video deleted successfully from database");
      res.json({ message: "Video muvaffaqiyatli o'chirildi" });
    } catch (dbErr) {
      console.error("Database error during deletion:", dbErr);
      res.status(500).json({ error: "Serverda xatolik yuz berdi" });
    }
  });

  // Likes & Dislikes
  app.post("/api/videos/:id/like", authenticateToken, (req: any, res) => {
    const videoId = req.params.id;
    const userId = req.user.id;

    const existingLike = db.prepare("SELECT * FROM video_likes WHERE userId = ? AND videoId = ?").get(userId, videoId);
    const existingDislike = db.prepare("SELECT * FROM video_dislikes WHERE userId = ? AND videoId = ?").get(userId, videoId);

    if (existingLike) {
      db.prepare("DELETE FROM video_likes WHERE userId = ? AND videoId = ?").run(userId, videoId);
      db.prepare("UPDATE videos SET likes = likes - 1 WHERE id = ?").run(videoId);
      res.json({ liked: false, disliked: false });
    } else {
      if (existingDislike) {
        db.prepare("DELETE FROM video_dislikes WHERE userId = ? AND videoId = ?").run(userId, videoId);
        db.prepare("UPDATE videos SET dislikes = dislikes - 1 WHERE id = ?").run(videoId);
      }
      db.prepare("INSERT INTO video_likes (userId, videoId) VALUES (?, ?)").run(userId, videoId);
      db.prepare("UPDATE videos SET likes = likes + 1 WHERE id = ?").run(videoId);
      res.json({ liked: true, disliked: false });
    }
  });

  app.post("/api/videos/:id/dislike", authenticateToken, (req: any, res) => {
    const videoId = req.params.id;
    const userId = req.user.id;

    const existingLike = db.prepare("SELECT * FROM video_likes WHERE userId = ? AND videoId = ?").get(userId, videoId);
    const existingDislike = db.prepare("SELECT * FROM video_dislikes WHERE userId = ? AND videoId = ?").get(userId, videoId);

    if (existingDislike) {
      db.prepare("DELETE FROM video_dislikes WHERE userId = ? AND videoId = ?").run(userId, videoId);
      db.prepare("UPDATE videos SET dislikes = dislikes - 1 WHERE id = ?").run(videoId);
      res.json({ liked: false, disliked: false });
    } else {
      if (existingLike) {
        db.prepare("DELETE FROM video_likes WHERE userId = ? AND videoId = ?").run(userId, videoId);
        db.prepare("UPDATE videos SET likes = likes - 1 WHERE id = ?").run(videoId);
      }
      db.prepare("INSERT INTO video_dislikes (userId, videoId) VALUES (?, ?)").run(userId, videoId);
      db.prepare("UPDATE videos SET dislikes = dislikes + 1 WHERE id = ?").run(videoId);
      res.json({ liked: false, disliked: true });
    }
  });

  app.get("/api/videos/:id/reaction", authenticateToken, (req: any, res) => {
    const liked = db.prepare("SELECT * FROM video_likes WHERE userId = ? AND videoId = ?").get(req.user.id, req.params.id);
    const disliked = db.prepare("SELECT * FROM video_dislikes WHERE userId = ? AND videoId = ?").get(req.user.id, req.params.id);
    res.json({ liked: !!liked, disliked: !!disliked });
  });

  // Comments
  app.get("/api/videos/:id/comments", (req, res) => {
    const comments = db.prepare(`
      SELECT c.*, u.name as userName, u.avatar as userAvatar 
      FROM comments c 
      JOIN users u ON c.userId = u.id 
      WHERE c.videoId = ? 
      ORDER BY c.created_at DESC
    `).all(req.params.id);
    res.json(comments);
  });

  app.post("/api/videos/:id/comments", authenticateToken, (req: any, res) => {
    const { text } = req.body;
    const info = db.prepare("INSERT INTO comments (videoId, userId, text) VALUES (?, ?, ?)")
      .run(req.params.id, req.user.id, text);
    
    const comment = db.prepare(`
      SELECT c.*, u.name as userName, u.avatar as userAvatar 
      FROM comments c 
      JOIN users u ON c.userId = u.id 
      WHERE c.id = ?
    `).get(info.lastInsertRowid);

    res.json(comment);
  });

  // User Profile
  app.get("/api/users/:id", (req, res) => {
    const user: any = db.prepare("SELECT id, name, avatar, created_at FROM users WHERE id = ?").get(req.params.id);
    if (!user) return res.status(404).json({ error: "Foydalanuvchi topilmadi" });
    
    const videos = db.prepare("SELECT * FROM videos WHERE userId = ? ORDER BY created_at DESC").all(req.params.id);
    res.json({ ...user, videos });
  });

  // Subscriptions
  app.post("/api/users/:id/subscribe", authenticateToken, (req: any, res) => {
    const followerId = req.user.id;
    const followingId = req.params.id;

    if (followerId == followingId) return res.status(400).json({ error: "O'zingizga obuna bo'la olmaysiz" });

    const existing = db.prepare("SELECT * FROM subscriptions WHERE followerId = ? AND followingId = ?").get(followerId, followingId);

    if (existing) {
      db.prepare("DELETE FROM subscriptions WHERE followerId = ? AND followingId = ?").run(followerId, followingId);
      res.json({ subscribed: false });
    } else {
      db.prepare("INSERT INTO subscriptions (followerId, followingId) VALUES (?, ?)").run(followerId, followingId);
      res.json({ subscribed: true });
    }
  });

  app.get("/api/users/:id/is-subscribed", authenticateToken, (req: any, res) => {
    const existing = db.prepare("SELECT * FROM subscriptions WHERE followerId = ? AND followingId = ?").get(req.user.id, req.params.id);
    res.json({ subscribed: !!existing });
  });

  // User's own data
  app.get("/api/me/liked-videos", authenticateToken, (req: any, res) => {
    const videos = db.prepare(`
      SELECT v.*, u.name as userName, u.avatar as userAvatar 
      FROM videos v 
      JOIN video_likes vl ON v.id = vl.videoId 
      JOIN users u ON v.userId = u.id 
      WHERE vl.userId = ?
      ORDER BY v.created_at DESC
    `).all(req.user.id);
    res.json(videos);
  });

  app.get("/api/me/subscriptions", authenticateToken, (req: any, res) => {
    const channels = db.prepare(`
      SELECT u.id, u.name, u.avatar 
      FROM users u 
      JOIN subscriptions s ON u.id = s.followingId 
      WHERE s.followerId = ?
    `).all(req.user.id);
    res.json(channels);
  });

  app.get("/api/me/videos", authenticateToken, (req: any, res) => {
    const videos = db.prepare(`
      SELECT v.*, u.name as userName, u.avatar as userAvatar 
      FROM videos v 
      JOIN users u ON v.userId = u.id 
      WHERE v.userId = ?
      ORDER BY v.created_at DESC
    `).all(req.user.id);
    res.json(videos);
  });

  // Notifications
  app.get("/api/notifications", authenticateToken, (req: any, res) => {
    const notifications = db.prepare(`
      SELECT * FROM notifications 
      WHERE userId = ? 
      ORDER BY created_at DESC 
      LIMIT 50
    `).all(req.user.id);
    res.json(notifications);
  });

  app.post("/api/notifications/:id/read", authenticateToken, (req: any, res) => {
    db.prepare("UPDATE notifications SET isRead = 1 WHERE id = ? AND userId = ?").run(req.params.id, req.user.id);
    res.json({ success: true });
  });

  app.post("/api/notifications/read-all", authenticateToken, (req: any, res) => {
    db.prepare("UPDATE notifications SET isRead = 1 WHERE userId = ?").run(req.user.id);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  server.timeout = 600000; // 10 minutes
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
