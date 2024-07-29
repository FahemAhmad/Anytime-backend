import express from "express";
import { isAuthenticated } from "../middlewares";
import {
  getNotifications,
  markAllAsRead,
  markAsRead,
} from "../controllers/notifications";

export default (router: express.Router) => {
  router.get(`/notifications`, isAuthenticated, getNotifications);
  router.put(
    `/notifications/:notificationId/read`,
    isAuthenticated,
    markAsRead
  );
  router.put(`/notifications/mark-all-read`, isAuthenticated, markAllAsRead);
};
