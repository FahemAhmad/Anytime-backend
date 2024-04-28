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
});

export const UserModel = mongoose.model("User", UserSchema);
export const getUsers = () => UserModel.find();
export const getUsersByEmail = (email: string) => UserModel.findOne({ email });
export const getUserBySessionToken = (sessionToken: string) =>
  UserModel.findOne({
    "authentication.sessionToken": sessionToken,
  });
export const getUserById = (id: string) => UserModel.findById(id);
export const createUser = (values: Record<string, any>) =>
  new UserModel(values).save().then((user) => user.toObject());
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
