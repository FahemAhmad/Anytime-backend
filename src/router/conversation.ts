import express from "express";
import { isAuthenticated } from "../middlewares";
import {
  createConversation,
  getConversationByConversationId,
  getUserConversations,
  deleteConversation,
} from "../controllers/conversation";

export default (router: express.Router) => {
  router.get(`/conversations`, isAuthenticated, getUserConversations);
  router.get(
    "/conversations/:id",
    isAuthenticated,
    getConversationByConversationId
  );
  router.post(`/conversations`, isAuthenticated, createConversation);
  router.put(`/conversations/remove`, isAuthenticated, deleteConversation);
};
