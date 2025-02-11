import { pusherServer } from "../lib/pusher";
import {
  IConversation,
  createNewConversation,
  getConversationById,
  getExistingConversations,
  getUserConversationByUserId,
  updateConversationById,
} from "../db/conversation";
import express from "express";

import mongoose from "mongoose";
import { UserModel } from "../db/users";

/**
 * This function creates a new conversation based on the request body.
 * The request body should contain a name, a boolean indicating if the conversation is a group or not,
 * and an array of member ids if the conversation is a group.
 * For a group conversation, at least 2 members are required and a name must be provided.
 * For a single conversation, the array of member ids should only contain one member.
 * If the conversation already exists, the function returns the existing conversation.
 * Otherwise, it creates a new conversation and returns it.
 *
 * @param {express.Request & { identity: any }} req - The request object containing the request body.
 * @param {express.Response} res - The response object to send the response.
 * @returns {Promise<void>} The function does not return anything, but sends a response with the conversation data.
 */
export const createConversation = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    // Extract the necessary data from the request body
    const { name, isGroup, userIds, groupImage, subject, testDate } = req.body;

    // Check if the data is valid for a group conversation
    if (isGroup && (!userIds || userIds.length < 1 || !name)) {
      // If the data is invalid, return a 400 error with a message

      return res.status(400).json({
        message:
          "Invalid data, for group conversations at least 2 userIds are required",
      });
    }

    const conversationId = new mongoose.Types.ObjectId();
    const timestamp = new Date();
    // If the conversation is a group conversation
    if (isGroup) {
      // Create a new conversation with the necessary data

      const newConversationObj = {
        _id: conversationId,
        createdAt: timestamp,
        updatedAt: timestamp,
        name,
        isGroup,
        groupImage,
        subject,
        testDate,
        messageIds: [] as any,
        userIds: [...userIds, (req as any).identity._id],
        admin: (req as any).identity._id,
      };

      const userDetails = await UserModel.find({
        _id: { $in: newConversationObj.userIds },
      });

      // get the sender details of all users from redis
      const responseObj = { ...newConversationObj, userIds: userDetails };

      responseObj.userIds.forEach(async (user: any) => {
        if (user.email) {
          await pusherServer.trigger(
            user.email,
            "conversation:new",
            responseObj
          );
        }
      });

      const newConversation = await createNewConversation(newConversationObj);
      await newConversation.save();

      // Send a 200 response with the new conversation data
      return res.status(200).json({ data: newConversation });
    }

    // Check if the conversation already exists
    const existingConversations = await getExistingConversations(
      (req as any).identity._id,
      userIds[0]
    );

    const singleConversations = existingConversations[0];

    // If the conversation already exists, return the existing conversation
    if (singleConversations) {
      return res.status(200).json({ data: singleConversations });
    }

    // If the conversation does not exist, create a new conversation
    const newSingleConversationObj = {
      _id: conversationId,
      createdAt: timestamp,
      modifiedAt: timestamp,
      name,
      isGroup,
      userIds: [...userIds, (req as any).identity._id],
      messageIds: [] as any,
    };

    const userDetails = await UserModel.find({
      _id: { $in: newSingleConversationObj.userIds },
    });

    // get the sender details of all users from redis
    const responseObj = { ...newSingleConversationObj, userIds: userDetails };

    responseObj.userIds.map(async (user: any) => {
      if (user.email) {
        await pusherServer.trigger(user.email, "conversation:new", responseObj);
      }
    });

    const newSingleConversation = await createNewConversation(
      newSingleConversationObj
    );

    await newSingleConversation.save();

    // Send a 200 response with the new conversation data
    return res.status(200).json({ data: newSingleConversation });
  } catch (error: any) {
    console.log("error", error);
    // If there is an error, send a 500 error with the error message
    return res.status(500).json({ error: error.message });
  }
};

// Get User Conversations
export const getUserConversations = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const userId = (req as any).identity._id;

    const conversations: any = await getUserConversationByUserId(userId);

    return res.status(200).json({ data: conversations });
  } catch (error: any) {
    console.log("ero", error);
    return res.status(500).json({ error: error.message });
  }
};

//get conversation by Id
export const getConversationByConversationId = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { id } = req.params;
    const conversation = await getConversationById(id);

    // if exist return it else return Unauthorized
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    if (conversation) {
      conversation.userIds.forEach((user: any) => {
        if (user._id.toString() === (req as any).identity._id.toString()) {
          return res.status(200).json({ data: conversation });
        }
      });
    } else {
      return res.status(401).json({ error: "Unauthorized" });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const deleteConversation = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { conversationId } = req.body;

    if (!conversationId) {
      return res.status(400).json({ message: "Conversation id is required" });
    }

    const conversation = await getConversationById(conversationId);

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    if (conversation) {
      //remove from userIds
      conversation.userIds.forEach((user: any) => {
        if (user._id.toString() === (req as any).identity._id.toString()) {
          //remove from userIds
          const index = conversation.userIds.indexOf(user);
          if (index > -1) {
            conversation.userIds.splice(index, 1);
          }
        }
      });
    }

    await conversation.save();
    return res
      .status(200)
      .json({ message: "Conversation deleted successfully" });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const updateGroupDetails = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { conversationId } = req.params;
    const { name, subject, testDate, groupImage, userIds } = req.body;

    const conversation: any = await getConversationById(conversationId);

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Check if the user is the admin of the group
    if (
      conversation.admin.toString() !== (req as any).identity._id.toString()
    ) {
      return res
        .status(403)
        .json({ error: "Only the admin can update group details" });
    }

    const updates: Partial<IConversation> = {};

    if (name) updates.name = name;
    if (subject) updates.subject = subject;
    if (testDate) updates.testDate = testDate;
    if (groupImage) updates.groupImage = groupImage;
    if (userIds) updates.userIds = userIds;

    const updatedConversation: any = await updateConversationById(
      conversationId,
      updates
    );

    updatedConversation.userIds.forEach(async (user: any) => {
      if (user.email) {
        await pusherServer.trigger(
          user.email,
          "conversation:update",
          updatedConversation
        );
      }
    });

    return res.status(200).json({ data: updatedConversation });
  } catch (error: any) {
    console.error("Error updating group details:", error);
    return res.status(500).json({ error: error.message });
  }
};
