// src/lib/redisMessages.ts

import { redisClient } from "../index";

const USER_PREFIX = "user_details_";

//User caching
export const saveUserDetailsToRedis = async (
  userId: string,
  userDetails: any
) => {
  const key = `${USER_PREFIX}${userId}`;
  const userDetailsString = JSON.stringify(userDetails);
  await redisClient.set(key, userDetailsString);
};

export const getUserDetailsFromRedis = async (userId: string): Promise<any> => {
  const key = `${USER_PREFIX}${userId}`;
  try {
    const userDetailsString = await redisClient.get(key);
    return userDetailsString ? JSON.parse(userDetailsString) : null;
  } catch (err) {
    console.error(
      `Error retrieving user details from Redis for user ID ${userId}:`,
      err
    );
    throw err;
  }
};
// Conversation caching
const CONVERSATION_PREFIX = "conversation_details_";

export const saveConversationDetailsToRedis = async (
  conversationId: string,
  conversationDetails: any
) => {
  const key = `${CONVERSATION_PREFIX}${conversationId}`;
  const conversationDetailsString = JSON.stringify(conversationDetails);
  // Set the conversation details in Redis with an expiration time (optional)
  const expireTimeInSeconds = 60 * 60 * 24; // For example, 24 hours
  await redisClient.setEx(key, expireTimeInSeconds, conversationDetailsString);
};

export const getConversationFromRedisByConversationId = async (
  conversationId: string
): Promise<any | null> => {
  const key = `${CONVERSATION_PREFIX}${conversationId}`;
  try {
    const conversationString = await redisClient.get(key);
    return conversationString ? JSON.parse(conversationString) : null;
  } catch (error) {
    console.error(
      `Error retrieving conversation from Redis for conversation ID ${conversationId}:`,
      error
    );
    throw error;
  }
};

export const getConversationDetailsFromRedis = async (
  conversationId: string
): Promise<any | null> => {
  const key = `${CONVERSATION_PREFIX}${conversationId}`;
  try {
    const conversationDetailsString = await redisClient.get(key);
    return conversationDetailsString
      ? JSON.parse(conversationDetailsString)
      : null;
  } catch (error) {
    console.error(
      `Error retrieving conversation details from Redis for conversation ID ${conversationId}:`,
      error
    );
    throw error; // Re-throw the error to handle it in the calling function
  }
};

//Message Caching
const MESSAGE_PREFIX = "conversation_messages_";

export const saveMessageToRedis = async (
  conversationId: string,
  message: any
) => {
  const key = `${MESSAGE_PREFIX}${conversationId}`;
  // Convert the message object to a JSON string for storage
  const messageString = JSON.stringify(message);
  // Push the message onto the list for the conversation in Redis
  await redisClient.rPush(key, messageString);
};

export const getMessageHistoryFromRedis = async (
  conversationId: string
): Promise<any[]> => {
  const key = `${MESSAGE_PREFIX}${conversationId}`;
  const messages = await redisClient.lRange(key, 0, -1);
  return messages.map((message) => JSON.parse(message));
};
