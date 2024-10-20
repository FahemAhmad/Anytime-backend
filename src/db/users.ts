import { saveUserDetailsToRedis } from "../lib/redisService";
import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
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
      unique: true,
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
      },
      sessionExpiry: {
        type: Date,
        default: null,
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
      // lessons offered by the user
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Lesson",
      },
    ],
    bookings: [
      // booking requests recevied by the user
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
    followers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    following: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    notifications: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Notification",
      },
    ],
    university: {
      type: String,
    },
    expertise: {
      type: String,
    },
    introduction: {
      type: String,
    },
    savedCards: [
      {
        last4: String,
        brand: String,
        stripePaymentMethodId: String,
      },
    ],
    stripeCustomerId: String,
    credits: {
      type: Number,
      default: 0,
    },
    stripeConnectedAccountId: String,
    stripeBankAccountId: String,
    country: {
      type: String,
      default: "",
    },
    role: {
      type: String,
      default: "user",
      enum: ["user", "admin", "superadmin"],
    },
    status: {
      type: Boolean,
      default: true, // true means active, false means blocked
    },
  },
  {
    timestamps: true,
  }
);

UserSchema.index({ createdAt: -1 });
UserSchema.index({ lessons: 1 });

export const UserModel = mongoose.model("User", UserSchema);

export const getUsers = () => UserModel.find().populate("lessons");
export const getUsersByEmail = (email: string) => UserModel.findOne({ email });

export const searchUsersDb = (searchTerm: string, currentUserId: string) => {
  const searchWords = searchTerm.split(/\s+/).filter((word) => word.length > 0);
  const regexPatterns = searchWords.map((word) => new RegExp(word, "i"));

  return UserModel.find(
    {
      _id: { $ne: currentUserId },
      $or: [
        { username: { $regex: searchTerm, $options: "i" } },
        { firstName: { $in: regexPatterns } },
        { lastName: { $in: regexPatterns } },
        {
          $expr: {
            $regexMatch: {
              input: { $concat: ["$firstName", " ", "$lastName"] },
              regex: searchTerm,
              options: "i",
            },
          },
        },
      ],
    },
    {
      _id: 1,
      firstName: 1,
      lastName: 1,
      email: 1,
      username: 1,
      avatarUrl: 1,
    }
  );
};

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
  UserModel.findByIdAndUpdate(id, values, { new: true });

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

export const addCardToUser = (
  userId: string,
  cardData: { last4: string; brand: string; stripePaymentMethodId: string }
) =>
  UserModel.findByIdAndUpdate(
    userId,
    { $push: { savedCards: cardData } },
    { new: true }
  );

export const getCardsByUserId = (userId: string) => {
  return UserModel.findById(userId).select("savedCards");
};

export const removeCardFromUser = (
  userId: string,
  stripePaymentMethodId: string
) =>
  UserModel.findByIdAndUpdate(
    userId,
    { $pull: { savedCards: { stripePaymentMethodId: stripePaymentMethodId } } },
    { new: true }
  );
