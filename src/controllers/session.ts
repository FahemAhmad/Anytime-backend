import { getUserById } from "../db/users";
import { createNewRatingDb } from "../db/rating";
import {
  createNewSessionDb,
  getAllSessions,
  getSessionByIdDB,
} from "../db/session";
import express from "express";
import moment from "moment";
import { createNotification } from "../db/notifications";
import { pusherServer } from "../lib/pusher";

interface LiveSession extends Document {
  isLive?: boolean;
}

export const createNewSession = async (
  req: express.Request & { identity: any },
  res: express.Response
) => {
  try {
    const {
      subject,
      topic,
      meetingUrl,
      tutorId,
      time,
      date,
      duration,
      description,
      role,
    } = req.body;

    const newSession = await createNewSessionDb({
      subject,
      topic,
      sessionUrl: meetingUrl,
      tutorId,
      startTime: time,
      sessionDuration: duration,
      startDate: date,
      description,
      role,
    });

    const newRating = await createNewRatingDb({
      sessionId: newSession._id,
      instructorId: req.identity._id,
    });

    newSession.ratings = newRating._id;

    await newRating.save();
    await newSession.save();

    newSession.ratings = newRating;

    const tutor = await getUserById(tutorId);

    console.log("tutor", tutor.followers);
    if (tutor && tutor.followers.length > 0) {
      // Create a notification for each follower
      const notificationPromises = tutor.followers.map(
        async (followerId: any) => {
          console.log("followers", followerId);
          // Create database notification
          const notification = await createNotification(followerId as any, {
            type: "info",
            title: "New Session Available",
            message: `${tutor.firstName} ${tutor.lastName} has hosted a new session on ${subject}`,
          });

          // Send Pusher notification
          await pusherServer.trigger(
            `${followerId}-notifications`,
            "notification:new",
            notification
          );

          return notification;
        }
      );

      await Promise.all(notificationPromises);
    }

    return res.status(200).json({ data: newSession });
  } catch (err) {
    console.log("er", err);
    return res.status(500).json({ error: err.message });
  }
};

export const getAllSessionsWithLiveFirst = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const now = moment(); // Current time

    // Find all sessions
    let sessions: any = await getAllSessions();

    // Add a field 'isLive' to each session document
    sessions = sessions.map((session: any) => {
      const extendedSession = session as unknown as LiveSession;
      const sessionStart = moment(
        `${session.startDate} ${session.startTime}`,
        "DD-MM-YYYY h:mm A"
      );
      const sessionEnd = sessionStart
        .clone()
        .add(session.sessionDuration, "minutes");
      extendedSession.isLive =
        now.isAfter(sessionStart) && now.isBefore(sessionEnd); // Boolean indicating if the session is live
      return extendedSession;
    });

    // Sort sessions so that live sessions come first
    sessions.sort((a: LiveSession, b: LiveSession) => {
      if (a.isLive && !b.isLive) return -1;
      if (!a.isLive && b.isLive) return 1;
      return 0; // Keep original order if both are live or not live
    });

    res.status(200).json({ data: sessions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getSessionById = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const newSession = await getSessionByIdDB(req.params.id);
    return res.status(200).json({ data: newSession });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
