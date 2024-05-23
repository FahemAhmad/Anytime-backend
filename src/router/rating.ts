import express from "express";
import { isAuthenticated } from "../middlewares";

import { updateRating } from "../controllers/rating";

export default (router: express.Router) => {
  router.put(`/ratings`, isAuthenticated, updateRating);
};
