import {
  getLessonStats,
  getUserStats,
  getPaymentStats,
  getOverallStats,
  testSession,
} from "../controllers/statistics";
import express from "express";
import { authenticateAdmin } from "../middlewares";

export default (router: express.Router) => {
  router.get('/statistics/test',testSession);
  router.get(`/statistics`, authenticateAdmin, getOverallStats);
  router.get(`/statistics/users`, authenticateAdmin, getUserStats);
  router.get(`/statistics/lessons`, authenticateAdmin, getLessonStats);
  router.get(`/statistics/payments`, authenticateAdmin, getPaymentStats);
};
