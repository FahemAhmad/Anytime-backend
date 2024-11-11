import mongoose from "mongoose";

const BankSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Types.ObjectId, required: true, ref: "User" },
    nationalIdNumber: { type: Number, required: true },
    accountHolderName: { type: String, required: true },
    dateOfBirth: { type: String, required: true },
    currency: { type: String, required: true },
    address: {
      country: { type: String, required: true },
      postalCode: { type: String, required: true },
      state: { type: String, required: true },
      city: { type: String, required: true },
      line1: { type: String, required: true },
    },
    bankCountry: { type: String, required: true },
    bankName: { type: String, required: true },
    accountNumber: { type: String },
    routingNumber: { type: String },
    iban: { type: String },
    stripeBankAccountId: { type: String, select: false },
    stripeExternalAccountId: { type: String, required: true, select: false },
  },
  { timestamps: true }
);

export const BankModel = mongoose.model("Bank", BankSchema);

export const getBankById = (bankId: string) =>
  BankModel.findById(bankId).select(
    "stripeExternalAccountId stripeBankAccountId userId"
  );
