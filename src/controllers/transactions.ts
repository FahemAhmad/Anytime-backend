import { getUserById } from "../db/users";
import {
  createTransaction,
  getTransactionsByUserId,
  TransactionModel,
} from "../db/transactions";
import { Request, Response } from "express";
import { MESSAGES } from "../helpers/notifications";
import { createNotification } from "../db/notifications";
import { pusherServer } from "../lib/pusher";

export const getUserTransactions = async (
  req: Request & { identity: any },
  res: Response
) => {
  try {
    const userId = req.identity._id;
    const user: any = await getUserById(userId);
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

export const newTransactionByAdmin = async (req: Request, res: Response) => {
  try {
    const user = await getUserById(req.body.user);

    if (!user) return res.status(200).json({ message: "User not found" });

    const newTransaction = await createTransaction({
      user: user._id,
      amount: req.body.amount,
      type: req.body.type,
      paymentMethod: req.body.paymentMethod,
    });

    user.credits += req.body.amount;
    // add transaction to user
    user.transactions.push(newTransaction._id);

    const createdNotification = await createNotification(req.body.user, {
      type: "info",
      title: MESSAGES.CREDIT_ADDED,
      message: `You’ve received ${req.body.amount} credits from the MediPals admin!`,
    });

    await pusherServer.trigger(
      `${req.body.user}-notifications`,
      "notification:new",
      createdNotification
    );

    user.notifications = [
      ...(user.notifications || []),
      createdNotification._id,
    ];
    await user.save();

    return res.status(200).json({ message: "Transaction successful" });
  } catch (err) {
    console.log("error", err);
    return res.status(500).json({ error: "Error fetching transactions" });
  }
};
