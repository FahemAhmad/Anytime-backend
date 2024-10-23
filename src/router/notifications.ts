import express from "express";
import { authenticateAdmin, isAuthenticated } from "../middlewares";
import {
  allNotificationsByAdmin,
  createNewNotification,
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

  //admin routes
  // announcements by the admin
  router.get(
    "/notifications/admin",
    authenticateAdmin,
    allNotificationsByAdmin
  );

  //create new announcement
  router.post(
    "/notifications/announcement-by-admin",
    authenticateAdmin,
    createNewNotification
  );
};
