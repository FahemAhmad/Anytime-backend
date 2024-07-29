import express from "express";
import { isAuthenticated } from "../middlewares";
import { sendFeedbackApi } from "../controllers/feedback";

export default (router: express.Router) => {
  router.post("/feedback", isAuthenticated, sendFeedbackApi);
};
