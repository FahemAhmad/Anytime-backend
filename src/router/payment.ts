import express from "express";
import { isAuthenticated } from "../middlewares";

import { addCredits, initStripe } from "../controllers/payment";

export default (router: express.Router) => {
  router.post(`/payment/init`, isAuthenticated, initStripe);
  router.post(`/payment/add-credits`, isAuthenticated, addCredits);
};
