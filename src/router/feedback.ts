import express from "express";
import { authenticateAdmin, isAuthenticated } from "../middlewares";
import {
  createFeedback,
  getAllFeedbacks,
  resolveFeedbacks,
} from "../controllers/feedback";

export default (router: express.Router) => {
  router.get("/feedback", authenticateAdmin, getAllFeedbacks);
  router.post("/feedback", isAuthenticated, createFeedback);
  router.patch("/feedback/:id", authenticateAdmin, resolveFeedbacks);
};
