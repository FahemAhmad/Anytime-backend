import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["info", "action", "reminder"],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    admin: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export const NotificationModel = mongoose.model(
  "Notification",
  NotificationSchema
);

export const createNotification = async (
  userId: string,
  notificationData: Record<string, any>
) => {
  const notification = new NotificationModel({
    user: userId,
    ...notificationData,
  });
  const savedNotification = await notification.save();

  return savedNotification;
};

export const markNotificationAsRead = (notificationId: string) =>
  NotificationModel.findByIdAndUpdate(notificationId, { isRead: true });
