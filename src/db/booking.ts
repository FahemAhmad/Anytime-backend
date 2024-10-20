import mongoose from "mongoose";

const BookingSchema = new mongoose.Schema(
  {
    lessonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lesson",
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // user who booked the lesson
    },
    tutorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    dateStamp: String,
    dateOfLesson: String,
    timeOfLesson: {
      type: String,
      enum: ["Morning", "Afternoon", "Evening"],
    },
    hourOflesson: String,
    isPaid: { type: Boolean, default: false },
    status: {
      type: String,
      enum: [
        "DELIVERED",
        "PENDING",
        "REJECTED",
        "ACCEPTED",
        "COMPLETED",
        "UNPAID",
      ],
      default: "PENDING",
    },
    proofOfDelivery: { type: String },
    ratingDetails: {
      rating: { type: Number },
      feedback: {
        type: String,
      },
    },
  },
  {
    timestamps: true,
  }
);

BookingSchema.index({ createdAt: -1 });
BookingSchema.index({ userId: 1 });
BookingSchema.index({ lessonId: 1 });
BookingSchema.index({ tutorId: 1 });
BookingSchema.index({ status: 1 });

export const BookingModel = mongoose.model("Booking", BookingSchema);

export const createNewBookingDb = (values: Record<string, any>) => {
  return new BookingModel(values).save();
};

export const getBookingByBookingId = (bookingId: string) => {
  return BookingModel.findOne({ _id: bookingId }).populate("tutorId lessonId");
};
