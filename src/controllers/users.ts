import express from "express";
import {
  UserModel,
  addCardToUser,
  getCardsByUserId,
  getUserById,
  getUsers,
  removeCardFromUser,
  searchUsersDb,
  updateUserById,
} from "../db/users";
import { BookingModel } from "../db/booking";
import {
  attachPaymentMethodToCustomer,
  createOrRetrieveStripeCustomer,
} from "./payment";
import { createTransaction } from "../db/transactions";

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
  req: express.Request & { identity: any },
  res: express.Response
) => {
  try {
    const { value } = req.query;

    if (!value) {
      return res.status(400).json({ message: "Email is required" });
    }

    const users = await searchUsersDb(value as string, req.identity._id);

    return res.status(200).json({ data: users }).end();
  } catch (error) {
    console.log(error);
    return res.sendStatus(400);
  }
};

export const getTutors = async (
  req: express.Request & { identity: any },
  res: express.Response
) => {
  try {
    //get list of users, who have any lesson that is active and the list should be sorted by user with most lessons
    const users = await UserModel.find({
      lessons: { $exists: true, $not: { $size: 0 } },
    })
      .populate({
        path: "lessons",
        match: { active: true },
      })
      .populate({
        path: "bookings",
        populate: {
          path: "userId",
        },
      });

    const usersWithActiveLessons = users
      .filter((user) => user.lessons.length > 0)
      .map((user) => {
        user.lessons = user.lessons.filter((lesson: any) => lesson.active);
        return user;
      });

    // Shuffle the filtered users to randomize the results
    const randomizedUsers = shuffleArray(usersWithActiveLessons);

    return res.status(200).json(randomizedUsers);
  } catch (error) {
    console.log("err", error);
    return res.sendStatus(400);
  }
};

export const followUnfollowUser = async (
  req: express.Request & { identity: any },
  res: express.Response
) => {
  try {
    // Get current user who is following
    const id = req.identity._id;
    const isFollow = req.query.follow === "true";

    // Get user who is being followed
    const userToFollow = req.body.tutor;

    // Update follow
    const userFollowing = await getUserById(id);
    const tutorFollowed = await getUserById(userToFollow);

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
  req: express.Request & { identity: any },
  res: express.Response
) => {
  try {
    const tutorId = req.query.tutorId;

    const tutorDetails = getUserById(tutorId as string);

    // also populate following
    const data = await tutorDetails.populate("followers").populate("following");
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
  req: express.Request & { identity: any },
  res: express.Response
) => {
  try {
    const userId = req.identity._id;

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
        (booking) => new Date(booking.dateStamp).getFullYear() === year
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

      const count = last30DaysBookings.filter((booking) => {
        const bookingDate = new Date(booking.dateStamp);
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
        (booking) => booking.dateStamp.split("T")[0] === dateString
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
  req: express.Request & { identity: any },
  res: express.Response
) => {
  try {
    const userId = req.identity._id;
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

export const addCard = async (
  req: express.Request & { identity: any },
  res: express.Response
) => {
  try {
    const userId = req.identity._id;
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
  req: express.Request & { identity: any },
  res: express.Response
) => {
  try {
    const userId = req.identity._id;
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
  req: express.Request & { identity: any },
  res: express.Response
) => {
  try {
    const userId = req.identity._id;
    const cards = await getCardsByUserId(userId);
    res.status(200).json({ cards });
  } catch (error) {
    console.error("Error fetching user cards:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deductCredits = async (
  req: express.Request & { identity: any },
  res: express.Response
) => {
  try {
    const userId = req.identity._id;
    const { amount, bookingId } = req.body; // Add lessonId to the request body

    const user = await getUserById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.credits < amount) {
      return res.status(400).json({ error: "Insufficient credits" });
    }

    const updatedUser = await updateUserById(userId, {
      $inc: { credits: -amount },
    });

    console.log("bookingId", bookingId);
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
