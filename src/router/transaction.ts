import express from "express";
import { authenticateAdmin, isAuthenticated } from "../middlewares";
import {
  getAllTransactions,
  getUserTransactions,
  newTransctionByAdmin,
} from "../controllers/transactions";

export default (router: express.Router) => {
  // To be used by admin
  router.get("/transactions/all", authenticateAdmin, getAllTransactions);
  router.post("/transactions/admin", authenticateAdmin, newTransctionByAdmin);

  router.get("/transactions", isAuthenticated, getUserTransactions);
};
