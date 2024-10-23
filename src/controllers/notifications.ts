import { pusherServer } from "../lib/pusher";
import {
  NotificationModel,
  createNotification,
  markNotificationAsRead,
} from "../db/notifications";
import express from "express";

export const getNotifications = async (
  req: express.Request & { identity: any },
  res: express.Response
) => {
  try {
    const id = req.identity._id;
    const notifications = await NotificationModel.find({
      $or: [{ user: id }, { admin: true }],
    })
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

    if (
      updatedNotification.user.toString() !== userId.toString() &&
      !updatedNotification.admin
    ) {
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

export const allNotificationsByAdmin = async (
  req: express.Request & { identity: any },
  res: express.Response
) => {
  try {
    const notifications = await NotificationModel.find({ admin: true })
      .sort({ createdAt: -1 }) // Sort notifications by creation date (newest first)
      .lean();

    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: "Error fetching notifications" });
  }
};

export const createNewNotification = async (
  req: express.Request,
  res: express.Response
) => {
  const { title, content, recipients } = req.body;

  // Check for required fields
  if (!title || !content || !recipients) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    if (recipients === "all") {
      // Create a notification for all users
      const createdNotification = await createNotification(req.user._id, {
        type: "info",
        title,
        message: content,
        data: { recipients }, // Store "all" in data
        isRead: false,
        admin: true,
      });

      // Send notification to all users
      await pusherServer.trigger(
        "all-users-notifications",
        "notification:new",
        createdNotification
      );

      return res.status(201).json(createdNotification);
    } else {
      // Create notification for a specific user
      const userIds = recipients.split(",").map((id: any) => id.trim());

      const createdNotifications = await Promise.all(
        userIds.map(async (userId: any) => {
          const notification = await createNotification(userId, {
            type: "info",
            title,
            message: content,
            data: { recipients: userId }, // Store specific user ID
            isRead: false,
            admin: true,
          });

          // Send notification to the specific user
          await pusherServer.trigger(
            `${userId}-notifications`,
            "notification:new",
            {
              title,
              message: content,
              id: notification._id,
              admin: true,
            }
          );

          return notification;
        })
      );

      return res.status(201).json(createdNotifications);
    }
  } catch (error) {
    console.error("Error creating announcement:", error);
    return res.status(500).json({ message: "Error creating announcement" });
  }
};
