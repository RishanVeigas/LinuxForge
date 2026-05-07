import "dotenv/config";
import express from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import { requireAuth } from "./middleware/auth.js";

import cors from "cors";

const app = express();
app.use(express.json());
// Connect to MongoDB
connectDB();

// Body parsing
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  }),
);

app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      collectionName: "sessions",
      ttl: 14 * 24 * 60 * 60, // 14 days
    }),
    cookie: {
      maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days in ms
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // HTTPS only in prod
      sameSite: "strict",
    },
  }),
);

// Auth routes (public — no login required)
app.use("/auth", authRoutes);

// ─── YOUR LINUXFORGE FEATURES BELOW ───────────────────────────────────────────
// Wrap all feature routes with requireAuth so only logged-in users can access them

// Option A: Protect an entire router
// const featuresRouter = require('./routes/features');
// app.use('/features', requireAuth, featuresRouter);

// Option B: Protect individual routes
// app.get('/dashboard', requireAuth, (req, res) => { ... });
// app.post('/run-command', requireAuth, (req, res) => { ... });

// ─── Example protected route (remove when you wire in real routes) ─────────────
app.get("/dashboard", requireAuth, (req, res) => {
  res.json({ message: `Welcome to LinuxForge, ${res.locals.email}!` });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
