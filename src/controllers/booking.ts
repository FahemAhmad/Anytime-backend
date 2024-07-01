import { getUserById } from "../db/users";
import { createNewBookingDb, getBookingByBookingId } from "../db/booking";
import express from "express";
import { identity } from "lodash";

//create a new lesson
export const bookASpot = async (
  req: express.Request & { identity: any },
  res: express.Response
) => {
  try {
    // Create a new booking
    const body = req.body;
    // save booking to user table
    const newBooking = await createNewBookingDb({
      ...body,
      userId: req.identity._id,
      tutorId: req.body.tutorId,
    });

    const userDetails = await getUserById(req.identity._id);
    const tutor = await getUserById(req.body.tutorId);

    if (userDetails.bookings) userDetails.bookings.push(newBooking._id);
    else userDetails.bookings = [newBooking._id];

    if (tutor.bookings) tutor.bookings.push(newBooking._id);
    else tutor.bookings = [newBooking._id];

    await tutor.save();
    await userDetails.save();

    return res.status(200).json(newBooking);

    // update the spot from lesson table
  } catch (err) {
    console.log("error", err);
    return res.status(500).json({ error: err.message });
  }
};

export const bookingPayed = async (
  req: express.Request & { identity: any },
  res: express.Response
) => {
  try {
    // Create a new booking
    const bookingId = req.params.id;

    const booking = await getBookingByBookingId(bookingId);
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    booking.isPaid = true;
    await booking.save();

    // update the spot from lesson table
    return res.status(200).json({ success: true });
  } catch (err) {
    console.log("errir", err);
    return res.status(500).json({ error: err.message });
  }
};

export const changeBookingStatus = async (
  req: express.Request & { identity: any },
  res: express.Response
) => {
  try {
    const bookingId = req.params.id;

    const bookings = await getBookingByBookingId(bookingId);

    if (!bookings) return res.status(404).json({ error: "Booking not found" });

    bookings.status = req.body.status;
    await bookings.save();

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const addProof = async (
  req: express.Request & { identity: any },
  res: express.Response
) => {
  try {
    const bookingId = req.params.id;

    const bookings = await getBookingByBookingId(bookingId);

    if (!bookings) return res.status(404).json({ error: "Booking not found" });

    bookings.proofOfDelivery = req.body.proof;
    bookings.status = "DELIVERED";
    await bookings.save();

    return res.status(200).json({ success: true });
  } catch (err) {
    console.log("errir", err);
    return res.status(500).json({ error: err.message });
  }
};

export const addFeedback = async (
  req: express.Request & { identity: any },
  res: express.Response
) => {
  try {
    const bookingId = req.params.id;

    const bookings = await getBookingByBookingId(bookingId);

    if (!bookings) return res.status(404).json({ error: "Booking not found" });

    bookings.ratingDetails = {
      rating: req.body.rating,
      feedback: req.body.feedback,
    };

    await bookings.save();
    const tutor = await getUserById(bookings.tutorId as any);

    if (tutor.ratings === "N/A") {
      tutor.ratings = req.body.rating;
      tutor.ratedCount = 1;
    } else {
      const currentRating = parseInt(tutor?.ratings || "0");

      let totalRating = currentRating * tutor.ratedCount;
      totalRating += parseInt(req.body.rating);
      totalRating = totalRating / (tutor.ratedCount + 1);
      tutor.ratings = totalRating.toString();
      tutor.ratedCount = tutor.ratedCount + 1;
    }

    await tutor.save();

    return res.status(200).json({ success: true });
  } catch (err) {
    console.log("err", err);
    return res.status(500).json({ error: err.message });
  }
};
