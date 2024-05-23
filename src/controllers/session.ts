import { createNewRatingDb } from "../db/rating";
import {
  createNewSessionDb,
  getAllSessions,
  getSessionByIdDB,
} from "../db/session";
import express from "express";
import moment from "moment";

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
    return res.status(200).json({ data: newSession });
  } catch (err) {
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

    //for the list of comments in sessions, get the comments and their replies
    // const commentsWithRepliesPromises = sessions.map(async (session: any) => {
    //   const commentsWithReplies = await Promise.all(
    //     session.comments.map(async (commentId: any) => {
    //       const comment = await getCommentByCommentIdDB(commentId);

    //       //travers the replies list
    //       const replies = await Promise.all(
    //         comment.replies.map(async (replyId: any) => {
    //           return await getCommentByCommentIdDB(replyId.toString());
    //         })
    //       );

    //       return { ...comment, replies };
    //     })
    //   );

    //   return { ...session, comments: commentsWithReplies };
    // });

    // const sessionsWithComments = await Promise.all(commentsWithRepliesPromises);

    // console.log("sess", sessionsWithComments[0].comments[0]);

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
