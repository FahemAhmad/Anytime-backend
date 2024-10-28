import { getUserById, updateUserById } from "../db/users";
import {
  BookingModel,
  createNewBookingDb,
  getBookingByBookingId,
} from "../db/booking";
import express from "express";
import { createNotification } from "../db/notifications";
import {
  MESSAGES,
  getBookingReceivedNotifications,
  getBookingStatusUpdate,
} from "../helpers/notifications";
import { getLessonDetailsByIdDb } from "../db/lesson";
import { pusherServer } from "../lib/pusher";
import { createTransaction } from "../db/transactions";

//create a new lesson
export const bookASpot = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    // Create a new booking
    const body = req.body;
    // save booking to user table
    const newBooking = await createNewBookingDb({
      ...body,
      userId: (req as any).identity._id,
      tutorId: req.body.tutorId,
    });

    const userDetails: any = await getUserById((req as any).identity._id);
    const tutor: any = await getUserById(req.body.tutorId);

    if (userDetails && userDetails.bookings)
      userDetails.bookings.push(newBooking._id);
    else userDetails.bookings = [newBooking._id];

    if (tutor && tutor.bookings) tutor.bookings.push(newBooking._id);
    else tutor.bookings = [newBooking._id];

    const lesson = await getLessonDetailsByIdDb(req.body.lessonId);

    // drop a notification to tutor
    const createdNotification = await createNotification(req.body.tutorId, {
      type: "action",
      title: MESSAGES.BOOKING_RECEIVED,
      message: getBookingReceivedNotifications(
        `${userDetails?.firstName || ""} ${userDetails?.lastName || ""}`,
        `${lesson?.subject || ""}`,
        `${req.body.dateOfLesson} ${req.body.hourOflesson}`
      ),
    });

    await pusherServer.trigger(
      `${req.body.tutorId}-notifications`,
      "notification:new",
      createdNotification
    );

    if (tutor.notifications) {
      tutor.notifications.push(createdNotification._id);
    } else {
      tutor.notifications = [createdNotification._id];
    }

    await tutor.save();
    await userDetails.save();

    return res.status(200).json(newBooking);

    // update the spot from lesson table
  } catch (err: any) {
    console.log("error", err);
    return res.status(500).json({ error: err.message });
  }
};

export const bookingPayed = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    // Create a new booking
    const bookingId = req.params.id;
    const { paymentIntentId, amount } = req.body;
    const userId = (req as any).identity._id;

    const isPaidQuery = req.query.isPaid;
    const isPaid = isPaidQuery !== undefined ? isPaidQuery === "true" : true;

    console.log("check point 1 ");

    const booking = await getBookingByBookingId(bookingId);
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    booking.isPaid = isPaid;
    await booking.save();

    let transaction = undefined;
    if (!isPaidQuery) {
      transaction = await createTransaction({
        user: userId,
        booking: bookingId,
        amount,
        paymentIntentId,
      });

      // Update user's transactions
      const user = await getUserById(userId);
      if (user) {
        user.transactions.push(transaction._id);
        await updateUserById(userId, { transactions: user.transactions });
      }
    }

    return res.status(200).json(transaction);
  } catch (err: any) {
    console.log("console.log", err);

    return res.status(500).json({ error: err.message });
  }
};

export const changeBookingStatus = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const bookingId = req.params.id;

    const bookings: any = await getBookingByBookingId(bookingId);

    if (!bookings) return res.status(404).json({ error: "Booking not found" });

    const statusMessages: Record<string, string> = {
      ACCEPTED: MESSAGES.BOOKING_ACCEPTED,
      REJECTED: MESSAGES.BOOKING_REJECTED,
      COMPLETED: MESSAGES.BOOKING_DELIVERED,
      PENDING: MESSAGES.BOOKING_PENDING,
      DELIVERED: MESSAGES.BOOKING_DELIVERED,
    };

    const createdNotification = await createNotification(bookings.userId, {
      type: "action",
      title: statusMessages[req.body.status],
      message: getBookingStatusUpdate(
        `${bookings?.tutorId?.firstName || ""} ${
          bookings?.tutorId?.lastName || ""
        }`,
        `${req.body.status}`,
        `${bookings?.lessonId?.subject || ""}`
      ),
    });

    await pusherServer.trigger(
      `${
        req.body.status === "COMPLETED" ? bookings.tutorId._id : bookings.userId
      }-notifications`,
      "notification:new",
      createdNotification
    );

    bookings.status = req.body.status;
    await bookings.save();

    return res.status(200).json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const addProof = async (req: express.Request, res: express.Response) => {
  try {
    const bookingId = req.params.id;

    const bookings: any = await getBookingByBookingId(bookingId);

    if (!bookings) return res.status(404).json({ error: "Booking not found" });

    bookings.proofOfDelivery = req.body.proof;
    bookings.status = "DELIVERED";
    await bookings.save();

    const createdNotification = await createNotification(bookings.userId, {
      type: "action",
      title: "DELIVERED",
      message: getBookingStatusUpdate(
        `${bookings?.tutorId?.firstName || ""} ${
          bookings?.tutorId?.lastName || ""
        }`,
        "DELIVERED",
        `${bookings?.lessonId?.subject || ""}`
      ),
    });

    //send to user that your application is accepted or rejected
    await pusherServer.trigger(
      `${bookings.userId}-notifications`,
      "notification:new",
      createdNotification
    );

    return res.status(200).json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const addFeedback = async (
  req: express.Request,
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
    const tutor: any = await getUserById(bookings.tutorId as any);

    if (tutor.ratings === "N/A") {
      tutor.ratings = req.body.rating;
      tutor.ratedCount = 1;
    } else {
      const currentRating = parseInt(tutor?.ratings || "0");

      let totalRating = currentRating * tutor.ratedCount;
      totalRating += parseInt(req.body.rating);
      // console.log("total rating", totalRating);
      // console.log("total rating 3", totalRating / (tutor.ratedCount + 1));
      totalRating = totalRating / (tutor.ratedCount + 1);
      tutor.ratings = totalRating.toString();
      tutor.ratedCount = tutor.ratedCount + 1;
      // console.log("total rating 2", tutor.ratedCount);
    }

    await tutor.save();

    return res.status(200).json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const getAllBookings = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const bookings = await BookingModel.find()
      .populate("lessonId", "subject")
      .populate("userId", "firstName lastName")
      .populate("tutorId", "firstName lastName username");

    return res.status(200).json({ success: true, data: bookings });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Error fetching bookings", error });
  }
};
