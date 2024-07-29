export const getBookingReceivedNotifications = (
  userId: string,
  lesson: string,
  timeSlot: string
): string => {
  
  return `${userId} has booked a lesson on ${lesson} at ${timeSlot}.`;
};

export const getBookingStatusUpdate = (
  tutorName: string,
  status: string,
  lesson: string
): string => {
  return `${tutorName} has ${status} the following lesson request: ${lesson}.`;
};
export const MESSAGES = {
  BOOKING_RECIEVED: "New Booking Request",
  BOOKING_ACCEPTED: "Booking Accepted",
  BOOKING_REJECTED: "Booking Rejected",
  BOOKING_DELIVERED: "Lesson Delivered",
};
