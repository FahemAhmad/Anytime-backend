import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    comment: String,
    like: { type: Number, default: 0 },
    dislike: { type: Number, default: 0 },
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    replies: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Comment",
      },
    ],
    isReply: {
      type: Boolean,
      default: false,
    },
    likedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    dislikedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  {
    timestamps: true,
  }
);

export const CommentModel = mongoose.model("Comment", commentSchema);

// To add comment need to do following things
// 1. Create new comment
// 2. push new comment using pusher
// 3. Add comment to session

export const createNewCommentDb = (
  comment: string,
  sessionId: string,
  userId: string,
  isReply: boolean
) => {
  return new CommentModel({
    comment,
    session: sessionId,
    userId,
    isReply,
    replies: [],
  });
};

export const getCommentByCommentIdDB = (commentId: string) =>
  CommentModel.findById(commentId);

export const likeDislikeACommentDb = async (
  commentId: string,
  isLike: boolean,
  userId: string,
  isReverse: boolean
) => {
  const comment = await CommentModel.findById(commentId);

  // Update like/dislike count based on isReverse
  if (isLike && !isReverse) {
    comment.like += 1;
  } else if (!isLike && !isReverse) {
    comment.dislike += 1;
  } else if (isLike && isReverse) {
    comment.like -= 1; // Handle removing like
  } else if (!isLike && isReverse) {
    comment.dislike -= 1; // Handle removing dislike
  }

  // Update like/dislike lists based on isReverse
  if (isLike && !isReverse && !comment.likedBy?.includes(userId as any)) {
    comment.likedBy = comment.likedBy || []; // Initialize if empty
    comment.likedBy.push(userId as any);
  } else if (
    !isLike &&
    !isReverse &&
    !comment.dislikedBy?.includes(userId as any)
  ) {
    comment.dislikedBy = comment.dislikedBy || []; // Initialize if empty
    comment.dislikedBy.push(userId as any);
  } else if (isLike && isReverse) {
    const likeIndex = comment.likedBy?.indexOf(userId as any);
    if (likeIndex !== -1) {
      comment.likedBy.splice(likeIndex, 1);
    }
  } else if (!isLike && isReverse) {
    const dislikeIndex = comment.dislikedBy?.indexOf(userId as any);
    if (dislikeIndex !== -1) {
      comment.dislikedBy.splice(dislikeIndex, 1);
    }
  }

  return await comment.save();
};
