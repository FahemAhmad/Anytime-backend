import express from "express";
import http from "http";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import compression from "compression";
import cors from "cors";
import mongoose from "mongoose";
import router from "./router";
import morgan from "morgan";
import { createClient } from "redis";

const REDIS_URL = "redis://localhost:6379";
const app = express();

app.use(
  cors({
    credentials: true,
    origin: "*",
    methods: "GET,PUT,POST,DELETE",
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(compression());
app.use(morgan("tiny"));
app.use(cookieParser());
app.use(bodyParser.json());

const server = http.createServer(app);

export const redisClient = createClient({
  url: "rediss://default:AbIiAAIncDExYjU0ODQ0MDE4OWM0MTdiOGE0NDNkMzc2YjYxYmY4MHAxNDU2MDI@right-camel-45602.upstash.io:6379",
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 2000), // Retry strategy with exponential backoff
    keepAlive: 10000, // TCP keepalive in milliseconds
  },
});

redisClient.on("error", (err) => console.log("Redis Client Error", err));
redisClient.on("connect", () => console.log("Redis connected"));

(async () => {
  await redisClient.connect();
})();

server.listen(8085, () => {
  console.log("server running on port 8085");
});

const MONGO_URL =
  "mongodb+srv://faheemahmad0108:c1N0TimFptCKc1C5@anytime-practice.hk6bf1e.mongodb.net/?retryWrites=true&w=majority";
mongoose.Promise = Promise;
mongoose.connect(MONGO_URL);
mongoose.connection.on("error", (error: Error) => console.log("error", error));
mongoose.connection.on("connected", () => console.log("connected"));

app.use("/", router());
