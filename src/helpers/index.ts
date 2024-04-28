import crypto from "crypto";

const SECRET = "secret";
const OTP_EXPIRY_TIME = 2;

export const random = () => crypto.randomBytes(128).toString("base64");

export const authentication = (salt: string, password: string) => {
  return crypto
    .createHmac("sha256", [salt, password].join("/"))
    .update(String(SECRET))
    .digest("hex");
};
export const generateOTP = () => {
  const otp = Math.floor(100000 + Math.random() * 900000);
  return otp.toString();
};

export const isOtpExpired = (otp_expiry_time: Date): boolean => {
  const currentTime = new Date();
  const timeDifference = currentTime.getTime() - otp_expiry_time.getTime();
  const timeDifferenceInMinutes = Math.floor(timeDifference / 1000 / 60);
  if (timeDifferenceInMinutes > OTP_EXPIRY_TIME) return true;
  return false;
};

export const isOtpCorrect = (userOtp: number, inputOtp: number): boolean => {
  return userOtp === inputOtp;
};
