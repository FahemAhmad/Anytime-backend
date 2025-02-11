import express from "express";
import {
  UserModel,
  addCardToUser,
  getCardsByUserId,
  getLinkedBanks,
  getUserById,
  getUsers,
  removeCardFromUser,
  searchUsersDb,
  updateUserById,
} from "../db/users";
import { BookingModel, getBookingByBookingId } from "../db/booking";
import {
  attachPaymentMethodToCustomer,
  createOrRetrieveStripeCustomer,
} from "./payment";
import { createTransaction, getTransactionsByUserId } from "../db/transactions";
import { isValidOffering } from "../helpers";

const shuffleArray = (array: any) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

export const getAllUsers = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const users = await getUsers();

    return res.status(200).json({ data: users }).end();
  } catch (error) {
    console.log(error);
    return res.sendStatus(400);
  }
};

export const searchUsers = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { value } = req.query;

    if (!value) {
      return res.status(400).json({ message: "Email is required" });
    }

    const users = await searchUsersDb(
      value as string,
      (req as any).identity._id
    );

    return res.status(200).json(users).end();
  } catch (error) {
    console.log(error);
    return res.sendStatus(400);
  }
};

export const getTutors = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    //get list of users, who have any lesson that is active and the list should be sorted by user with most lessons
    const users = await UserModel.find({
      lessons: { $exists: true, $not: { $size: 0 } },
    })
      .select(
        "-notifications -credits -savedCards -role -stripeConnectedAccountId -stripeBankAccountId -stripeCustomerId -provider -otp -isOtpVerified -conversationIds -authentication.sessionExpiry -authentication.sessionToken -transactions -seenMessageId -messages -isVerified -otpExpiryTime "
      )
      .populate({
        path: "lessons",
        match: { active: true },
      })
      .populate({
        path: "bookings",
        populate: {
          path: "userId",
          select: "_id username firstName lastName",
        },
      });

    //remove all lessons with no dates available
    let usersWithActiveLessons: any = users
      .map((user) => {
        user.lessons = user.lessons.filter((lesson: any) => {
          const validOfferings = isValidOffering(
            lesson?.availability.selectedDays
          );

          return lesson?.active && validOfferings;
        });
        return user.lessons.length > 0 ? user : null;
      })
      .filter(Boolean);

    const today = new Date();

    const newUsers = usersWithActiveLessons.filter((user: any) => {
      user.lessons = user.lessons.filter((lesson: any) => {
        const { startDate, endDate } = lesson.range;
        const start = new Date(startDate);
        const end = new Date(endDate);

        if (start < today && end >= today) {
          lesson.range.startDate = today.toISOString().split("T")[0];
          // Delete all entries before current date in availability
          lesson.availability.selectedDays =
            lesson.availability.selectedDays.filter((day: any) => {
              const dayDate = new Date(day.day);
              return dayDate >= today;
            });
        }

        // Delete days where morning, afternoon, and evening have no entries
        lesson.availability.selectedDays =
          lesson.availability.selectedDays.filter((day: any) => {
            const { morning, afternoon, evening } = day.timeSlots;
            return (
              morning.length > 0 || afternoon.length > 0 || evening.length > 0
            );
          });

        return lesson.availability.selectedDays.length > 0;
      });

      // Return only users who have at least one valid lesson
      return user.lessons.length > 0;
    });

    let randomizedUsers = [];
    if (newUsers && newUsers.length > 1)
      randomizedUsers = shuffleArray(newUsers);
    else if (users.length === 1) randomizedUsers.push(newUsers[0]);

    return res.status(200).json(randomizedUsers);
  } catch (error) {
    return res.sendStatus(400);
  }
};

export const followUnfollowUser = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    // Get current user who is following
    const id = (req as any).identity._id;
    const isFollow = req.query.follow === "true";

    // Get user who is being followed
    const userToFollow = req.body.tutor;

    // Update follow
    const userFollowing: any = await getUserById(id);
    const tutorFollowed: any = await getUserById(userToFollow);

    if (isFollow) {
      if (userFollowing?.following) {
        if (!userFollowing.following.includes(tutorFollowed._id)) {
          userFollowing.following.push(tutorFollowed._id);
        }
      } else {
        userFollowing.following = [tutorFollowed._id];
      }

      if (tutorFollowed?.followers) {
        if (!tutorFollowed.followers.includes(userFollowing._id)) {
          tutorFollowed.followers.push(userFollowing._id);
        }
      } else {
        tutorFollowed.followers = [userFollowing._id];
      }
    } else {
      if (userFollowing?.following) {
        const index = userFollowing.following.indexOf(tutorFollowed._id);
        if (index > -1) {
          userFollowing.following.splice(index, 1);
        }
      }

      if (tutorFollowed?.followers) {
        const index = tutorFollowed.followers.indexOf(userFollowing._id);
        if (index > -1) {
          tutorFollowed.followers.splice(index, 1);
        }
      }
    }

    await tutorFollowed.save();
    await userFollowing.save();

    return res.status(200).json({
      success: true,
    });
  } catch (err) {
    return res.status(500).send({ error: err });
  }
};

export const tutorFollowers = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const tutorId = req.query.tutorId;

    const tutorDetails = getUserById(tutorId as string);

    // also populate following
    const data: any = await tutorDetails
      .populate("followers")
      .populate("following");
    return res
      .status(200)
      .send({ followers: data.followers, following: data.following });
  } catch (err) {
    console.log("er");
    return res.status(500).send({ error: err });
  }
};

const calculateStatusDistribution = (bookings: any[]) => {
  const statusCounts = bookings.reduce((acc, booking) => {
    acc[booking.status] = (acc[booking.status] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(statusCounts).map(([status, count]) => ({
    status,
    count: count as number,
  }));
};

export const getStatistics = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const userId = (req as any).identity._id;

    // All-time statistics
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 4);
    startDate.setMonth(0, 1);
    startDate.setHours(0, 0, 0, 0);
    const startDateString = startDate.toISOString();

    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    const endDateString = endDate.toISOString();

    const allTimeBookings = await BookingModel.find({
      tutorId: userId,
      dateStamp: { $gte: startDateString, $lte: endDateString },
    }).lean();

    const yearlyStats = Array.from({ length: 5 }, (_, index) => {
      const year = new Date().getFullYear() - index;
      const count = allTimeBookings.filter(
        (booking: any) => new Date(booking?.dateStamp).getFullYear() === year
      ).length;
      return { year: year.toString(), count };
    }).reverse();

    // Last 30 days statistics
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    thirtyDaysAgo.setHours(0, 0, 0, 0);
    const thirtyDaysAgoString = thirtyDaysAgo.toISOString();

    const last30DaysBookings = await BookingModel.find({
      tutorId: userId,
      dateStamp: { $gte: thirtyDaysAgoString, $lte: endDateString },
    }).lean();

    const last30DaysStats = Array.from({ length: 6 }, (_, index) => {
      const startDay = index * 5;
      const endDay = startDay + 4;
      const startDate = new Date(thirtyDaysAgo);
      startDate.setDate(startDate.getDate() + startDay);
      const endDate = new Date(thirtyDaysAgo);
      endDate.setDate(endDate.getDate() + endDay);

      const count = last30DaysBookings.filter((booking: any) => {
        const bookingDate = new Date(booking?.dateStamp);
        return bookingDate >= startDate && bookingDate <= endDate;
      }).length;

      return {
        label: `${startDate.getDate()}/${
          startDate.getMonth() + 1
        } - ${endDate.getDate()}/${endDate.getMonth() + 1}`,
        count,
      };
    });

    // Last 7 days statistics
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const sevenDaysAgoString = sevenDaysAgo.toISOString();

    const last7DaysBookings = await BookingModel.find({
      tutorId: userId,
      dateStamp: { $gte: sevenDaysAgoString, $lte: endDateString },
    }).lean();

    const last7DaysStats = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(sevenDaysAgo);
      date.setDate(date.getDate() + index);
      const dateString = date.toISOString().split("T")[0];
      const count = last7DaysBookings.filter(
        (booking: any) => booking.dateStamp.split("T")[0] === dateString
      ).length;
      return { date: dateString, count };
    });

    const allTimeStatusDistribution =
      calculateStatusDistribution(allTimeBookings);
    const last30DaysStatusDistribution =
      calculateStatusDistribution(last30DaysBookings);
    const last7DaysStatusDistribution =
      calculateStatusDistribution(last7DaysBookings);

    const statistics = {
      taughtLessons: {
        allTime: yearlyStats,
        last30Days: last30DaysStats,
        last7Days: last7DaysStats,
      },
      statusDistribution: {
        allTime: allTimeStatusDistribution,
        last30Days: last30DaysStatusDistribution,
        last7Days: last7DaysStatusDistribution,
      },
    };

    res.status(200).json(statistics);
  } catch (error) {
    console.error("Error fetching statistics:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
export const updateProfile = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const userId = (req as any).identity._id;
    const {
      firstName,
      lastName,
      email,
      username,
      university,
      expertise,
      introduction,
      avatarUrl,
      country,
    } = req.body;

    // Create an object with the fields to update
    const updateFields: any = {};
    if (firstName) updateFields.firstName = firstName;
    if (lastName) updateFields.lastName = lastName;
    if (email) updateFields.email = email;
    if (username) updateFields.username = username;
    if (university) updateFields.university = university;
    if (expertise) updateFields.expertise = expertise;
    if (introduction) updateFields.introduction = introduction;
    if (avatarUrl) updateFields.avatarUrl = avatarUrl;
    if (country) updateFields.country = country;

    // Update the user profile
    const updatedUser = await updateUserById(userId, updateFields);

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Return the updated user object without sensitive information
    return res.status(200).json({
      message: "Profile updated successfully",
      user: { _doc: updatedUser },
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const addCard = async (req: express.Request, res: express.Response) => {
  try {
    const userId = (req as any).identity._id;
    const { last4, brand, stripePaymentMethodId } = req.body;

    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    let stripeCustomerId = await createOrRetrieveStripeCustomer(user);

    // If a new customer was created, update the user in the database
    if (stripeCustomerId !== user.stripeCustomerId) {
      await updateUserById(userId, { stripeCustomerId });
    }

    // Attach the payment method to the customer
    await attachPaymentMethodToCustomer(
      stripePaymentMethodId,
      stripeCustomerId
    );

    // Check if the card already exists
    const existingCards = await getCardsByUserId(userId);
    const cardExists = existingCards?.savedCards.some(
      (card) => card.last4 === last4 && card.brand === brand
    );

    if (cardExists) {
      return res
        .status(400)
        .json({ error: "This card has already been added" });
    }

    const updatedUser = await addCardToUser(userId, {
      last4,
      brand,
      stripePaymentMethodId,
    });

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    return res
      .status(200)
      .json(updatedUser.savedCards[updatedUser.savedCards.length - 1]);
  } catch (error) {
    console.error("Error adding card:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const removeCard = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const userId = (req as any).identity._id;
    const { stripePaymentMethodId } = req.body;

    const updatedUser = await removeCardFromUser(userId, stripePaymentMethodId);

    if (!updatedUser) {
      return res.status(404).json({ error: "User or card not found" });
    }

    res.status(200).json({ message: "Card removed successfully" });
  } catch (error) {
    console.error("Error removing card:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getUserCards = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const userId = (req as any).identity._id;
    const cards = await getCardsByUserId(userId);
    res.status(200).json({ cards });
  } catch (error) {
    console.error("Error fetching user cards:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deductCredits = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const userId = (req as any).identity._id;
    const { amount, bookingId } = req.body; // Add lessonId to the request body

    const user = await getUserById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.credits < amount) {
      return res.status(400).json({ error: "Insufficient credits" });
    }

    const existingbookings = await getBookingByBookingId(bookingId);
    if (!existingbookings) {
      return res.status(400).json({ error: "No booking found" });
    }

    existingbookings.isPaid = true;
    existingbookings.save();
    const updatedUser: any = await updateUserById(userId, {
      $inc: { credits: -amount },
    });

    // Create a transaction record
    await createTransaction({
      user: userId,
      amount: -amount, // Negative amount for deduction
      type: "CREDIT_DEDUCTION",
      booking: bookingId,
    });

    return res.status(200).json({
      success: true,
      remainingCredits: updatedUser.credits,
      message: "Credits deducted successfully",
    });
  } catch (error) {
    console.error("Error deducting credits:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getUserDetails = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const userId = req.params.id;
    const user = await getUserById(userId).populate("lessons");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const transactions = await getTransactionsByUserId(userId);

    const formattedTransactions = transactions.map((transaction) => ({
      details: getTransactionDetails(transaction),
      amount: transaction.amount,
      type: transaction.type,
      createdAt: transaction.createdAt,
    }));

    const userDetails = {
      id: user._id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      isVerified: user.isVerified,
      avatarUrl: user.avatarUrl,
      ratings: user.ratings,
      ratedCount: user.ratedCount,
      lessonsOffered: user.lessons,
      bookingRequests: user.bookings.length,
      followers: user.followers.length,
      following: user.following.length,
      university: user.university,
      expertise: user.expertise,
      introduction: user.introduction,
      credits: user.credits,
      country: user.country,
      transactions: formattedTransactions,
    };

    res.status(200).json(userDetails);
  } catch (error) {
    console.error("Error fetching user details:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

function getTransactionDetails(transaction: any) {
  switch (transaction.type) {
    case "BOOKING":
      return `Booked lesson: ${
        transaction.booking?.lessonId?.subject || "Unknown"
      }`;
    case "CREDIT_PURCHASE":
      return "Purchased credits";
    case "CREDIT_DEDUCTION":
      return "Credits deducted";
    case "WITHDRAWAL":
      return "Withdrawal";
    default:
      return "Unknown transaction";
  }
}

export const getAdminUser = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const user = req.user || (req as any).identity;

    if (!user) {
      return res
        .status(500)
        .json({ message: "User data not found in request" });
    }

    return res.status(200).json({
      id: user._id,
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl || "",
    });
  } catch (error) {
    console.error("Error fetching user data:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getAllAdmins = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const admins = await UserModel.find({
      $or: [{ role: "admin" }, { role: "superadmin" }],
    }).select("firstName lastName email username role _id");

    return res.status(200).json(admins);
  } catch (error) {
    console.error("Error fetching admins:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getBankDetails = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const userId = (req as any).identity._id;
    const userbanks = await getLinkedBanks(userId);
    return res.status(200).json(userbanks);
  } catch (error) {
    return res.status(500).json({ message: error });
  }
};
