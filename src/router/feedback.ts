import express from "express";
import { isAuthenticated } from "../middlewares";
import { createFeedback } from "../controllers/feedback";

export default (router: express.Router) => {
  router.post("/feedback", createFeedback);
};
