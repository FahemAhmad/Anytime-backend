const mongoose = require("mongoose");

const ratingSchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Session",
    required: true,
  },
  instructor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5,
    required: true,
  },
  ratedBy: {
    type: Number,
    default: 0,
  },
  ratedByUsers: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
});

export const RatingModel = mongoose.model("Rating", ratingSchema);

export const createNewRatingDb = ({
  sessionId,
  instructorId,
}: {
  sessionId: any;
  instructorId: any;
}) => {
  return new RatingModel({
    sessionId: sessionId,
    instructor: instructorId,
  });
};

export const findRatingBySessionIdDb = ({ sessionId }: { sessionId: any }) => {
  return RatingModel.findOne({ sessionId: sessionId }).exec();
};
