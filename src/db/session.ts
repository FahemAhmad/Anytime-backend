import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema(
  {
    subject: String,
    topic: String,
    sessionUrl: String,
    tutor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    startTime: String,
    startDate: String,
    sessionDuration: Number,
    viewersCount: Number,
    description: String,
    role: {
      type: String,
      enum: ["Learner", "Tutor"],
      required: true,
    },
    comments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Comment" }],
    ratings: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Rating",
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

export const SessionModel = mongoose.model("Session", sessionSchema);

export const createNewSessionDb = (sessionData: {
  subject: string;
  topic: string;
  sessionUrl: string;
  tutorId: mongoose.Types.ObjectId;
  startTime: string;
  startDate: string;
  sessionDuration: Number;
  description?: string;
  role: string;
}) =>
  new SessionModel({
    subject: sessionData.subject,
    topic: sessionData.topic,
    sessionUrl: sessionData.sessionUrl,
    tutor: sessionData.tutorId,
    startTime: sessionData.startTime,
    startDate: sessionData.startDate,
    sessionDuration: sessionData.sessionDuration,
    viewersCount: 0,
    comments: [],
    role: sessionData.role,
    description: sessionData.description || "",
  }).populate({
    path: "tutor",
    select: "_id firstName lastName avatarUrl email username ratings",
  });

export const getAllSessions = () =>
  SessionModel.find()
    .populate({
      path: "tutor",
      select: "_id firstName lastName avatarUrl email username",
    })
    .populate({
      path: "ratings",
    })
    .populate({
      path: "comments",
      populate: [
        {
          path: "userId",
          select: "_id firstName lastName avatarUrl",
        },
        {
          path: "replies",
          populate: {
            path: "userId",
            select: "_id firstName lastName avatarUrl",
          },
        },
      ],
    });

//find session by session id
export const getSessionByIdDB = (sessionId: string) =>
  SessionModel.findById(sessionId)
    .populate({
      path: "tutor",
      select: "_id firstName lastName avatarUrl email username ratings",
    })
    .populate({
      path: "ratings",
    })
    .populate({
      path: "comments",
      select: "_id userId comment userId replies",
      populate: [
        {
          path: "userId",
          select: "_id firstName lastName avatarUrl",
        },
        {
          path: "replies",
          select: "_id userId comment userId",
          populate: {
            path: "userId",
            select: "_id firstName lastName avatarUrl",
          },
        },
      ],
    });

export const increaseViewersCountDb = (id: string) =>
  SessionModel.findByIdAndUpdate(
    id,
    {
      $inc: { viewersCount: 1 },
    },
    { new: true }
  );
