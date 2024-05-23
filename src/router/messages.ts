import express from "express";
import { isAuthenticated } from "../middlewares";
import {
  createMessage,
  getMessages,
  messageSeen,
} from "../controllers/messages";

export default (router: express.Router) => {
  router.post(`/messages/:id/seen`, isAuthenticated, messageSeen);
  router.get(`/messages/:id`, isAuthenticated, getMessages);
  router.post(`/messages`, isAuthenticated, createMessage);
};
