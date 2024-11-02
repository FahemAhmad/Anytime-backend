import express from "express";
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
import mongoose from "mongoose";
import { getUserById } from "../db/users";

export const getMessages = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { id } = req.params;
    const messages = await getMessagesByConversationId(id);

    return res.status(200).json({ data: messages });
  } catch (err) {
    return res.status(500).json({ error: err });
  }
};

export const createMessage = async (
  req: express.Request,
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
      senderId: (req as any).identity._id,
      seenIds: [(req as any).identity._id],
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const senderDetails = await getUserById((req as any).identity._id);

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

    const newMessage: any = await createNewMessage(newMessageData);

    await newMessage.save();
    const returnedConversation = await updateConversation(
      conversationId,
      newMessage?._id.toString()
    );

    //pusher to add it

    const lastMessage =
      returnedConversation?.messageIds[
        returnedConversation.messageIds.length - 1
      ];

    returnedConversation?.userIds.map(async (user: any) => {
      await pusherServer.trigger(user.email!, "conversation:update", {
        _id: conversationId,
        messageIds: [lastMessage],
      });
    });
  } catch (err) {
    return res.status(500).json({ error: err });
  }
};

export const messageSeen = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { id } = req.params;
    const conversation = await setConversationMessageSeen(
      id,
      (req as any).identity._id.toString()
    );

    if (!conversation)
      return res.status(404).json({ error: "Conversation not found" });

    //Find last message
    const lastMessage: any =
      conversation.messageIds[conversation.messageIds.length - 1];

    if (!lastMessage) return res.status(200).json({ data: conversation });

    //update seen of last message
    const updatedMessage = await updateMessage(
      (req as any).identity._id.toString(),
      lastMessage._id.toString()
    );

    await pusherServer.trigger(
      (req as any)?.identity.email,
      "conversation:update",
      {
        id,
        messageIds: [updatedMessage],
      }
    );

    await pusherServer.trigger(id, "message:update", updatedMessage);

    if (
      lastMessage?.seenIds.indexOf((req as any).identity._id.toString()) !== -1
    ) {
      return res.status(200).json({ data: conversation });
    }

    return res.status(200).json({ data: conversation });
  } catch (err) {
    console.log("err", err);
    return res.status(500).json({ error: err });
  }
};
