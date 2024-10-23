import mongoose from "mongoose";

const TransactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
    },
    amount: {
      type: Number,
      required: true,
    },
    paymentIntentId: {
      type: String,
    },

    type: {
      type: String,
      enum: ["BOOKING", "CREDIT_PURCHASE", "CREDIT_DEDUCTION", "WITHDRAWAL"],
      required: true,
      default: "BOOKING",
    },

    paymentMethod: {
      type: String,
      enum: ["CARD", "CREDITS","ADMIN"],
      default: ["CARD"],
    },
  },
  { timestamps: true }
);

export const TransactionModel = mongoose.model(
  "Transaction",
  TransactionSchema
);

export const createTransaction = (values: Record<string, any>) =>
  new TransactionModel(values).save();

export const getTransactionById = (id: string) => TransactionModel.findById(id);

export const getTransactionsByUserId = (userId: string) =>
  TransactionModel.find({ user: userId })
    .sort({ createdAt: -1 })
    .populate({
      path: "booking",
      select: "lessonId",
      populate: {
        path: "lessonId",
        select: "subject",
      },
    });
