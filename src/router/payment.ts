import express from "express";
import { isAuthenticated } from "../middlewares";

import { initStripe } from "../controllers/payment";

export default (router: express.Router) => {
  router.post(`/payment/init`, isAuthenticated, initStripe);
};
