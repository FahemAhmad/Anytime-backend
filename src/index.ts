import express from "express";
import http from "http";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import compression from "compression";
import cors from "cors";
import mongoose from "mongoose";
import router from "./router";
import morgan from "morgan";

const app = express();

app.use(
  cors({
    credentials: true,
  })
);

app.use(compression());
app.use(morgan("tiny"));
app.use(cookieParser());
app.use(bodyParser.json());

const server = http.createServer(app);

server.listen(8080, () => {
  console.log("server running on port 8080");
});

const MONGO_URL =
  "mongodb+srv://faheemahmad0108:c1N0TimFptCKc1C5@anytime-practice.hk6bf1e.mongodb.net/?retryWrites=true&w=majority";
mongoose.Promise = Promise;
mongoose.connect(MONGO_URL);
mongoose.connection.on("error", (error: Error) => console.log("error", error));
mongoose.connection.on("connected", () => console.log("connected"));

app.use("/", router());
