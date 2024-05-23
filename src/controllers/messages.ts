import express from "express";
import { v4 as uuidv4 } from "uuid";
import {
  createNewMessage,
  getMessagesByConversationId,
  updateMessage,
} from "../db/message";
import {
  setConversationMessageSeen,
  updateConversation,
} from "../db/conversation";
import { pusherServer } from "../lib/pusher";
import {
  getUserDetailsFromRedis,
  saveMessageToRedis,
} from "../lib/redisService";
import mongoose from "mongoose";

export const getMessages = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { id } = req.params;
    const messages = await getMessagesByConversationId(id);

    return res.status(200).json({ data: messages });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const createMessage = async (
  req: express.Request & { identity: any },
  res: express.Response
) => {
  try {
    const { message, conversationId, image } = req.body;


    //create new mongoose objectId
    const messageId = new mongoose.Types.ObjectId();

    const timestamp = new Date();
    const newMessageData = {
      _id: messageId, // Use the generated UUID as the message ID
      body: message,
      message,
      image,
      conversationId,
      senderId: req.identity._id,
      seenIds: [req.identity._id],
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await saveMessageToRedis(conversationId, newMessageData);
    const senderDetails = await getUserDetailsFromRedis(req.identity._id);

    //make deep copy of newMessage data
    let newMessageDataResponse = { ...newMessageData };
    newMessageDataResponse.senderId = senderDetails;
    newMessageDataResponse.seenIds = [senderDetails];

    await pusherServer.trigger(
      conversationId,
      "message:new",
      newMessageDataResponse
    );
    res.status(200).json({ data: newMessageDataResponse });

    const newMessage = await createNewMessage(newMessageData);

    await newMessage.save();
    const returnedConversation = await updateConversation(
      conversationId,
      newMessage._id.toString()
    );

    //pusher to add it

    const lastMessage =
      returnedConversation?.messageIds[
        returnedConversation.messageIds.length - 1
      ];

    returnedConversation.userIds.map((user: any) => {
      pusherServer.trigger(user.email!, "conversation:update", {
        _id: conversationId,
        messageIds: [lastMessage],
      });
    });
  } catch (err) {
    console.log("erro", err);
    //return res.status(500).json({ error: err.message });
  }
};

export const messageSeen = async (
  req: express.Request & { identity: any },
  res: express.Response
) => {
  try {
    const { id } = req.params;
    const conversaton = await setConversationMessageSeen(
      id,
      req.identity._id.toString()
    );

    if (!conversaton)
      return res.status(404).json({ error: "Conversation not found" });

    //Find last message
    const lastMessage: any =
      conversaton.messageIds[conversaton.messageIds.length - 1];

    if (!lastMessage) return res.status(200).json({ data: conversaton });

    //update seen of last message
    const updatedMessage = await updateMessage(
      req.identity?._id.toString(),
      lastMessage._id.toString()
    );

    pusherServer.trigger(req.identity.email, "conversation:update", {
      id,
      messageIds: [updatedMessage],
    });

    pusherServer.trigger(id, "message:update", updatedMessage);

    if (lastMessage?.seenIds.indexOf(req.identity?._id.toString()) !== -1) {
      return res.status(200).json({ data: conversaton });
    }

    return res.status(200).json({ data: conversaton });
  } catch (err) {
    console.log("erro", err);
    return res.status(500).json({ error: err.message });
  }
};
