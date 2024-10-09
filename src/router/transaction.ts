import express from "express";
import { isAuthenticated } from "../middlewares";
import {
  getAllTransactions,
  getUserTransactions,
} from "../controllers/transactions";

export default (router: express.Router) => {
  router.get("/transactions", isAuthenticated, getUserTransactions);

  // To be used by admin
  router.get("/allTransactions", getAllTransactions);
};
