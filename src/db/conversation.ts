import mongoose from "mongoose";

export interface IConversation extends mongoose.Document {
  name?: string;
  isGroup: boolean;
  groupImage?: string;
  subject?: string;
  testDate?: string;
  messageIds: mongoose.Types.ObjectId[];
  userIds: mongoose.Types.ObjectId[];
  admin?: mongoose.Types.ObjectId;
  lastMessageAt: Date;
}

const ConversationSchema = new mongoose.Schema(
  {
    _id: mongoose.Schema.Types.ObjectId,
    lastMessageAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    name: String,
    isGroup: { type: Boolean, default: false },
    groupImage: String,
    subject: String,
    testDate: String,
    messageIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message",
      },
    ],
    userIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

export const ConversationModel = mongoose.model<IConversation>(
  "Conversation",
  ConversationSchema
);

export const getUserConversationByUserId = (currentUserID: string) =>
  ConversationModel.find({ userIds: currentUserID })
    .sort({ lastMessageAt: "desc" })
    .populate({
      path: "userIds",
      select: "firstName lastName avatarUrl email username",
      populate: {
        path: "messages",
        populate: {
          path: "sender",
          select: "name",
        },
      },
    })
    .populate({
      path: "messageIds",
      populate: {
        path: "seenIds",
      },
    });

/**
 * Create a new conversation with the given values.
 *
 * @param {Record<string, any>} values - The values to create the conversation with.
 * @return {Promise<ConversationModel>} - The created conversation.
 */
export const createNewConversation = (values: Record<string, any>) =>
  new ConversationModel({
    _id: values._id,
    name: values.name,
    isGroup: values.isGroup,
    userIds: values.userIds,
    groupImage: values.groupImage,
    subject: values.subject,
    testDate: values.testDate,
    createdAt: values.createdAt,
    updatedAt: values.updatedAt,
    messageIds: values.messageIds,
    admin: values.admin,
  }).populate("userIds");

/**
 * Retrieve an existing conversation between the current user and the target user.
 *
 * @param {string} currentUserId - The ID of the current user.
 * @param {string} targetUserId - The ID of the target user.
 * @return {Promise<ConversationModel[]>} - An array of conversation objects that match the search criteria.
 */
export const getExistingConversations = (
  currentUserId: string,
  targetUserId: string
) =>
  ConversationModel.find({
    $and: [
      {
        isGroup: { $eq: false },
      },
      {
        $or: [
          { userIds: { $all: [currentUserId, targetUserId] } },
          { userIds: { $all: [targetUserId, currentUserId] } },
        ],
      },
    ],
  });

export const getConversationById = (conversationId: string) =>
  ConversationModel.findById(conversationId).populate("userIds messageIds");

/**
 * Update a conversation by its ID with a new message.
 *
 * @param {string} conversationId - The ID of the conversation to update.
 * @param {string} newMessageId - The ID of the new message to add to the conversation.
 * @return {Promise<ConversationModel>} - The updated conversation model.
 */

export const updateConversation = (
  conversationId: string,
  newMessageId: string
) =>
  ConversationModel.findByIdAndUpdate(
    conversationId,
    {
      $push: { messageIds: newMessageId },
      $set: { lastMessageAt: Date.now() },
    },
    {
      new: true,
      populate: [
        { path: "userIds", select: "_id username email firstName lastName" },
        {
          path: "messageIds",
          populate: { path: "seenIds" },
        },
      ],
    }
  );

export const setConversationMessageSeen = (id: string, seenId: string) =>
  ConversationModel.findByIdAndUpdate(id, {
    $push: { seenIds: seenId },
  }).populate([
    { path: "userIds", select: "_id name" },
    { path: "messageIds", populate: { path: "seenIds" } },
  ]);

export const updateConversationById = (
  id: string,
  updates: Partial<IConversation>
) =>
  ConversationModel.findByIdAndUpdate(id, updates, { new: true })
    .populate("userIds")
    .populate({
      path: "messageIds",
      populate: {
        path: "seenIds",
      },
    });
