import express from "express";
import { authenticateAdmin, isAuthenticated } from "../middlewares";
import {
  addFeedback,
  addProof,
  bookASpot,
  bookingPayed,
  changeBookingStatus,
  getAllBookings,
} from "../controllers/booking";

export default (router: express.Router) => {
  router.get(`/bookings`, authenticateAdmin, getAllBookings);
  router.post(`/bookings`, isAuthenticated, bookASpot);
  router.put(`/bookings/:id/status`, isAuthenticated, changeBookingStatus);
  router.put(`/bookings/:id/payed`, isAuthenticated, bookingPayed);
  router.put(`/bookings/:id/proof`, isAuthenticated, addProof);
  router.put(`/bookings/:id/feedback`, isAuthenticated, addFeedback);

  // to be used for dashboard
  router.post("/bookings/:id/admin-payed", authenticateAdmin, bookingPayed);
  router.post(
    "/bookings/:id/admin-status",
    authenticateAdmin,
    changeBookingStatus
  );
};
