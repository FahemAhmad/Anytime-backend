import express from "express";

import {
  forgotPassword,
  login,
  oauthLogin,
  register,
  resendOtp,
  updatePassword,
  verifyOTP,
} from "../controllers/authentication";

export default (router: express.Router) => {
  router.post(`/auth/sign-up`, register);
  router.post(`/auth/sign-in`, login);
  router.post("/auth/verify-otp", verifyOTP);
  router.post("/auth/resend-otp", resendOtp);
  router.post("/auth/forgot-password", forgotPassword);
  router.put("/auth/update-password", updatePassword);
  router.post("/auth/providers/:providerName", oauthLogin);
};
