import express from "express";
import { authenticateAdmin, isAuthenticated } from "../middlewares";
import {
  getAllTransactions,
  getUserTransactions,
  newTransactionByAdmin,
} from "../controllers/transactions";

export default (router: express.Router) => {
  // To be used by admin
  router.get("/transactions/all", authenticateAdmin, getAllTransactions);
  router.post("/transactions/admin", authenticateAdmin, newTransactionByAdmin);

  router.get("/transactions", isAuthenticated, getUserTransactions);
};
