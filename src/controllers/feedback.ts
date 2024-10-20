// controllers/feedbackController.js
import { Request, Response } from "express";
import { FeedbackModel } from "../db/feedback";

// Create a new feedback
export const createFeedback = async (req: Request, res: Response) => {
  try {
    const { user, type, message } = req.body;

    // Validate required fields
    if (!user || !type || !message) {
      return res
        .status(400)
        .json({ error: "User, type, and message are required." });
    }

    // Validate feedback type
    const validTypes = ["help", "feedback", "problem"];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: "Invalid feedback type." });
    }

    // Create and save the feedback
    const feedback = new FeedbackModel({ user, type, message });
    await feedback.save();

    res.status(201).json(feedback);
  } catch (error) {
    console.error("Error creating feedback:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const markFeedbackResolved = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const feedback = await FeedbackModel.findByIdAndUpdate(
      id,
      { resolved: true },
      { new: true }
    );

    if (!feedback) {
      return res.status(404).json({ error: "Feedback not found." });
    }

    res.status(200).json(feedback);
  } catch (error) {
    console.error("Error marking feedback as resolved:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
