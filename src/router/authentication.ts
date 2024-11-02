import express from "express";

import {
  adminLogin,
  changePassword,
  createAdmin,
  forgotPassword,
  login,
  logout,
  oauthLogin,
  register,
  resendOtp,
  updatePassword,
  verifyOTP,
  blockUser,
  deleteAdmin,
} from "../controllers/authentication";
import {
  authenticateAdmin,
  authenticateSuperAdmin,
  isAuthenticated,
} from "../middlewares";

export default (router: express.Router) => {
  router.post(`/auth/sign-up`, register);
  router.post(`/auth/sign-in`, login);
  router.post("/auth/verify-otp", verifyOTP);
  router.post("/auth/resend-otp", resendOtp);
  router.post("/auth/forgot-password", forgotPassword);
  router.put("/auth/update-password", updatePassword);
  router.post("/auth/providers/:providerName", oauthLogin);
  router.put("/auth/change-password", isAuthenticated, changePassword);

  // admin dashboard
  router.put(`/auth/block/:userId`, authenticateAdmin, blockUser);
  router.post(`/auth/admin-login`, adminLogin);
  router.post(
    "/auth/create-admin",
    authenticateAdmin,
    authenticateSuperAdmin,
    createAdmin
  );
  router.post("/auth/logout", logout);
  router.delete(
    "/auth/:id",
    authenticateAdmin,
    authenticateSuperAdmin,
    deleteAdmin
  );
};
