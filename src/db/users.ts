import { saveUserDetailsToRedis } from "../lib/redisService";
import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
  },
  firstName: {
    type: String,
    required: true,
  },
  lastName: {
    type: String,
  },
  email: {
    type: String,
    required: true,
  },
  authentication: {
    password: {
      type: String,
      select: false,
    },
    salt: {
      type: String,
      select: false,
    },
    sessionToken: {
      type: String,
      select: false,
    },
  },
  isVerified: {
    default: false,
    type: Boolean,
  },
  avatarUrl: {
    default: "",
    type: String,
  },
  otp: {
    type: Number,
    min: 100000,
    max: 999999,
  },
  otpExpiryTime: {
    type: Date,
  },
  isOtpVerified: {
    default: false,
    type: Boolean,
  },
  provider: {
    type: String,
    default: "email",
    enum: ["email", "google", "fb"],
  },
  conversationIds: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
    },
  ],
  seenMessagesId: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
  ],
  messages: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
  ],
  ratings: {
    type: String,
    default: "N/A",
  },
  ratedCount: {
    type: Number,
    default: 0,
  },
  lessons: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lesson",
    },
  ],
  bookings: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
    },
  ],
  transactions: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
    },
  ],
  followers: { type: Number, default: 0 },
  following: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
});

export const UserModel = mongoose.model("User", UserSchema);

export const getUsers = () => UserModel.find();
export const getUsersByEmail = (email: string) => UserModel.findOne({ email });

export const searchUserByEmail = (email: string, currentUserId: string) =>
  UserModel.find(
    {
      _id: { $ne: currentUserId }, // Exclude the current user by their ID
      email: { $regex: email, $options: "i" }, // Case-insensitive email search
    },
    {
      _id: 1,
      firstName: 1,
      lastName: 1,
      email: 1,
      avatarUrl: 1,
    }
  );

export const getUserBySessionToken = (sessionToken: string) =>
  UserModel.findOne({
    "authentication.sessionToken": sessionToken,
  });
export const getUserById = (id: string) => UserModel.findById(id);
export const createUser = (values: Record<string, any>) =>
  new UserModel(values).save().then((user) => {
    const userObject = user.toObject();

    saveUserDetailsToRedis(userObject._id.toString(), userObject).catch(
      (err) => {
        console.error("Failed to save user details to Redis:", err);
      }
    );
    return userObject;
  });

export const deleteUserById = (id: string) =>
  UserModel.findOneAndDelete({ _id: id });
export const updateUserById = (id: string, values: Record<string, any>) =>
  UserModel.findByIdAndUpdate(id, values);

// OTP LOGIC

export const createNewOtpByExpiry = async (
  userId: string,
  otp: string,
  expiryDurationInMinutes: number
): Promise<boolean> => {
  const currentTime = new Date();
  const otpExpiryTime = new Date(
    currentTime.getTime() + expiryDurationInMinutes * 60000
  );
  const result = await UserModel.findByIdAndUpdate(userId, {
    otp: Number(otp),
    otpExpiryTime: otpExpiryTime,
    isOtpVerified: false,
  });
  return !!result;
};

//Existing conversations
