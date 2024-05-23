import express from "express";
import { isAuthenticated } from "../middlewares";
import { createNewComment, likeDislikeAComment } from "../controllers/comment";

export default (router: express.Router) => {
  router.post(`/comments`, isAuthenticated, createNewComment);
  router.post("/comments/likeDislike", isAuthenticated, likeDislikeAComment);
};
