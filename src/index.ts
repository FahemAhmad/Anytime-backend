import express from "express";
import http from "http";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import compression from "compression";
import cors from "cors";
import mongoose from "mongoose";
import router from "./router";
import morgan from "morgan";

import "dotenv/config";
require("dotenv").config();

const app = express();

const allowedOrigin = "http://localhost:3000";

app.use(
  cors({
    credentials: true,
    origin: allowedOrigin,
    methods: "GET,PUT,POST,DELETE,PATCH",
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(compression());
app.use(morgan("tiny"));
app.use(cookieParser());
app.use(bodyParser.json());

const server = http.createServer(app);

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
