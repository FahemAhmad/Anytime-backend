import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema(
  {
    _id: mongoose.Schema.Types.ObjectId,
    body: String,
    image: String,
    seenIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

export const MessageModel = mongoose.model("Message", MessageSchema);

MessageSchema.index({ conversationId: 1 });
MessageSchema.index({ senderId: 1 });

export const getMessagesByConversationId = (conversationId: string) =>
  MessageModel.find({ conversationId })
    .populate("senderId seenIds")
    .sort({ createdAt: "asc" })
    .lean();

export const createNewMessage = ({
  message,
  image,
  conversationId,
  seenIds,
  senderId,
  _id,
}: {
  _id: any;
  message: string;
  image: string;
  conversationId: string;
  seenIds: string[];
  senderId: string;
}) =>
  new MessageModel({
    _id,
    body: message,
    image: image,
    conversationId,
    seenIds,
    senderId,
  }).populate("senderId seenIds");

export const updateMessage = (id: string, lastMessageId: string) =>
  MessageModel.findByIdAndUpdate(
    lastMessageId, // Filter by message ID
    { $addToSet: { seenIds: id } }, // Add currentUserID to seenIds array
    { new: true } // Return the updated message
  )
    .populate("senderId", "username _id firstName lastName email avatarUrl") // Include senderId in the result
    .populate("seenIds", "username _id firstName lastName email avatarUrl")
    .populate("conversationId");
