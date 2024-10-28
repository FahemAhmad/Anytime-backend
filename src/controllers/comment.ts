import { pusherServer } from "../lib/pusher";
import {
  createNewCommentDb,
  getCommentByCommentIdDB,
  likeDislikeACommentDb,
} from "../db/comment";
import express from "express";
import { getSessionByIdDB } from "../db/session";

export const createNewComment = async (
  req: express.Request & { identity: any },
  res: express.Response
) => {
  try {
    const { comment, sessionId, isReply, parentCommentId } = req.body;

    const newComment = createNewCommentDb(
      comment,
      sessionId,
      req.identity._id,
      isReply
    );

    let savedComment = undefined;
    if (isReply) {
      //since its a reply to a comment. first get that comment

      const existingComment: any = await getCommentByCommentIdDB(
        parentCommentId
      );

      //add the new comment to existing comment replies
      existingComment.replies.push(newComment._id);

      //update the session
      await newComment.save();
      savedComment = await existingComment.save();
    } else savedComment = await newComment.save();

    let returnedComment = await savedComment.populate({
      path: "userId",
    });

    returnedComment = await returnedComment.populate({
      path: "replies",
      populate: [
        {
          path: "userId",
        },
      ],
    });

    await pusherServer.trigger(sessionId, "comment:new", returnedComment);

    if (!isReply) {
      //get session and update its comments as well
      const response: any = await getSessionByIdDB(sessionId);
      // add new comment to session
      response.comments.push(savedComment._id);
      await response.save();
    }

    return res.status(201).json({ comment: {} });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// function to link and dislike a comment
export const likeDislikeAComment = async (
  req: express.Request & { identity: any },
  res: express.Response
) => {
  try {
    const { commentId, like, parentCommentId, isReverse, sessionId } = req.body;

    const newComment = await likeDislikeACommentDb(
      commentId,
      like,
      req.identity._id,
      isReverse
    );

    if (parentCommentId) {
      //since its a reply to a comment. first get that comment
      const existingComment: any = await getCommentByCommentIdDB(
        parentCommentId
      );
      let returnedComment = await existingComment.populate({
        path: "userId",
        select: "_id firstName lastName avatarUrl",
      });

      returnedComment = await returnedComment.populate({
        path: "replies",
        populate: [
          {
            path: "userId",
            select: "_id firstName lastName avatarUrl",
          },
        ],
      });

      await pusherServer.trigger(sessionId, "comment:update", existingComment);
    } else {
      await pusherServer.trigger(sessionId, "comment:update", newComment);
    }

    return res.status(200).json({
      comment: newComment,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
