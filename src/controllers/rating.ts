import { findRatingBySessionIdDb } from "../db/rating";
import express from "express";

export const updateRating = async (
  req: express.Request & { identity: any },
  res: express.Response
) => {
  try {
    const { sessionId, newRatingValue } = req.body;
    // Find the rating for the given session
    const rating = await findRatingBySessionIdDb({ sessionId });

    if (!rating) {
    }
    // Calculate the new rating value
    const totalRatings = rating.ratedBy;
    const currentRating = rating.rating;
    const newTotalRatings = totalRatings + 1;
    const newRating =
      (currentRating * totalRatings + newRatingValue) / newTotalRatings;

    // Update the rating document
    rating.rating = newRating;
    rating.ratedBy = newTotalRatings;
    if (!rating?.ratedByUsers?.includes(req.identity._id)) {
      if (!rating.ratedByUsers) {
        rating.ratedByUsers = [req.identity._id];
      } else if (!rating.ratedByUsers.includes(req.identity._id)) {
        rating.ratedByUsers.push(req.identity._id);
      }
    }
    await rating.save();

    res.status(200).json({ message: "Rating updated successfully" });
  } catch (error) {
    console.error("Error updating rating:", error);
    throw error;
  }
};
