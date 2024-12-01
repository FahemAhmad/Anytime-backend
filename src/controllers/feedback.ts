// controllers/feedbackController.js
import { Request, Response } from "express";
import { FeedbackModel } from "../db/feedback";

// Create a new feedback
export const createFeedback = async (req: Request, res: Response) => {
  try {
    const { type, message } = req.body;

    // Validate required fields
    if (!type || !message) {
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
    const feedback = new FeedbackModel({
      user: (req as any).identity._id,
      type,
      message,
    });
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

export const getAllFeedbacks = async (req: Request, res: Response) => {
  try {
    const feedbacks = await FeedbackModel.find().populate(
      "user",
      "username email firstName lastName "
    );
    res.status(200).json(feedbacks);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const resolveFeedbacks = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { resolved } = req.body;
    const feedback = await FeedbackModel.findByIdAndUpdate(
      id,
      { resolved: resolved },
      { new: true }
    );

    if (!feedback) {
      return res.status(404).json({ message: "Feedback not found" });
    }

    res.status(200).json(feedback);
  } catch (error) {
    res.status(500).json({ message: "Error updating feedback", error });
  }
};
