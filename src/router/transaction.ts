import express from "express";
import { isAuthenticated } from "../middlewares";
import { getUserTransactions } from "../controllers/transactions";

export default (router: express.Router) => {
  router.get("/transactions", isAuthenticated, getUserTransactions);
};
