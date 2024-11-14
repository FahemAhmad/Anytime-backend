import express from "express";
import { isAuthenticated } from "../middlewares";

import {
  addBank,
  addCredits,
  initStripe,
  payoutToBank,
  removeBank,
} from "../controllers/payment";

export default (router: express.Router) => {
  router.post("/payment/add-bank", isAuthenticated, addBank);
  router.delete("/payment/remove-bank/:bankId", isAuthenticated, removeBank);
  router.post(`/payment/init`, isAuthenticated, initStripe);
  router.post(`/payment/add-credits`, isAuthenticated, addCredits);
  router.post("/payment/payout", isAuthenticated, payoutToBank);
};
