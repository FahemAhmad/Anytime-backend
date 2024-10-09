import { getUserById } from "../db/users";
import { getTransactionsByUserId, TransactionModel } from "../db/transactions";
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

export const getAllTransactions = async (req: Request, res: Response) => {
  try {
    const transactions = await TransactionModel.find()
      .sort({ createdAt: -1 })
      .populate("user", "firstName lastName email username")
      .populate({
        path: "booking",
        select: "lessonId",
        populate: {
          path: "lessonId",
          select: "subject",
        },
      });

    // Return all transactions in the response

    return res.status(200).json({
      transactions,
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return res.status(500).json({ error: "Error fetching transactions" });
  }
};
