import express from "express";
import { sendFeedbackEmail } from "../helpers/mail";

export const sendFeedbackApi = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { type, message, source } = req.body;
    await sendFeedbackEmail(type, message, source);
    res.status(200).json({ message: "Feedback sent successfully" });
  } catch (error) {
    console.error("Error sending feedback:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
