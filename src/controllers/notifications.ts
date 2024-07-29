import { NotificationModel, markNotificationAsRead } from "../db/notifications";
import express from "express";

export const getNotifications = async (
  req: express.Request & { identity: any },
  res: express.Response
) => {
  try {
    const id = req.identity._id;
    const notifications = await NotificationModel.find({ user: id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: "Error fetching notifications" });
  }
};

export const markAsRead = async (
  req: express.Request & { identity: any },
  res: express.Response
) => {
  try {
    const { notificationId } = req.params;
    const userId = req.identity._id;

    const updatedNotification = await markNotificationAsRead(notificationId);

    if (!updatedNotification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    if (updatedNotification.user.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    res.json({ message: "Notification marked as read" });
  } catch (error) {
    res.status(500).json({ message: "Error marking notification as read" });
  }
};

export const markAllAsRead = async (
  req: express.Request & { identity: any },
  res: express.Response
) => {
  try {
    const userId = req.identity._id;

    await NotificationModel.updateMany(
      { user: userId, isRead: false },
      { isRead: true }
    );

    res.json({ message: "All notifications marked as read" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error marking all notifications as read" });
  }
};
