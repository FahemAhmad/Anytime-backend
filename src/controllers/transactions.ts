import { getUserById } from "../db/users";
import {
  getTransactionById,
  getTransactionsByUserId,
} from "../db/transactions";
import { Request, Response } from "express";

export const getUserTransactions = async (
  req: Request & { identity: any },
  res: Response
) => {
  try {
    const userId = req.identity._id;
    const user = await getUserById(userId);
    const transactions = await getTransactionsByUserId(userId);

    return res.status(200).json({
      transactions: transactions,
      credits: user.credits || 0,
    });
  } catch (error) {
    console.error("Error fetching user transactions:", error);
    return res.status(500).json({ error: "Error fetching user transactions" });
  }
};
