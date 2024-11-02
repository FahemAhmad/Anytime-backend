import express from "express";
import { isAuthenticated } from "../middlewares";
import {
  createNewSession,
  getAllSessionsWithLiveFirst,
  getSessionById,
  incrementView,
} from "../controllers/session";

export default (router: express.Router) => {
  router.post(`/session/`, isAuthenticated, createNewSession);
  router.get(`/session/`, isAuthenticated, getAllSessionsWithLiveFirst);
  router.get("/session/:id", isAuthenticated, getSessionById);
  router.get("/session/:id/count", isAuthenticated, incrementView);
};
