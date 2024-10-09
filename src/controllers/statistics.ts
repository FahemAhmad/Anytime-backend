// src/controllers/statsController.js

import { SessionModel } from "../db/session";
import { BookingModel } from "../db/booking";
import { UserModel } from "../db/users";
import { Request, Response } from "express";
import moment from "moment";
import { TransactionModel } from "../db/transactions";

export const getUserStats = async (req: Request, res: Response) => {
  try {
    // Define lesson count ranges
    const ranges = [
      { name: "0-5", min: 0, max: 5 },
      { name: "6-10", min: 6, max: 10 },
      { name: "11-20", min: 11, max: 20 },
      { name: "21-30", min: 21, max: 30 },
      { name: "31+", min: 31, max: Infinity },
    ];

    // Fetch counts and aggregates in parallel
    const [
      userCount,
      tutorCount,
      learnerCount,
      activeUserCount,
      tutorLessonCounts,
      learnerLessonCounts,
      totalRatingsResult,
      topCountriesResult,
      topRatedTutorsResult,
    ] = await Promise.all([
      UserModel.countDocuments(),
      UserModel.countDocuments({
        lessons: { $exists: true, $not: { $size: 0 } },
      }),
      BookingModel.distinct("userId").then((ids) => ids.length),
      UserModel.countDocuments({ status: true }),
      // For Tutors: Count of lessons per tutor
      UserModel.aggregate([
        { $match: { lessons: { $exists: true, $not: { $size: 0 } } } },
        { $project: { lessonCount: { $size: "$lessons" }, country: 1 } },
      ]),
      // For Learners: Count of lessons booked per learner
      BookingModel.aggregate([
        { $group: { _id: "$userId", lessonCount: { $sum: 1 } } },
      ]),
      // For Tutor Ratings: Sum and count of ratings
      BookingModel.aggregate([
        { $match: { "ratingDetails.rating": { $exists: true, $ne: null } } },
        {
          $group: {
            _id: null,
            total: { $sum: "$ratingDetails.rating" },
            count: { $sum: 1 },
          },
        },
      ]),
      UserModel.aggregate([
        {
          $facet: {
            topCountries: [
              { $match: { country: { $ne: "", $exists: true } } }, // Ensure 'country' exists and is not empty
              {
                $group: {
                  _id: "$country",
                  userCount: { $sum: 1 },
                },
              },
              { $sort: { userCount: -1 } },
              { $limit: 5 },
              {
                $project: {
                  country: "$_id",
                  userCount: 1,
                  _id: 0,
                },
              },
            ],
            naCount: [
              {
                $match: {
                  $or: [{ country: "" }, { country: { $exists: false } }],
                },
              },
              { $count: "naCount" },
            ],
          },
        },
      ]),
      UserModel.aggregate([
        {
          $match: {
            lessons: { $exists: true, $not: { $size: 0 } },
            ratings: { $ne: "N/A" },
          },
        },
        {
          $addFields: {
            numericRating: {
              $convert: {
                input: "$ratings",
                to: "double",
                onError: null,
                onNull: null,
              },
            },
          },
        },
        {
          $match: {
            numericRating: { $ne: null },
          },
        },
        { $sort: { numericRating: -1, ratedCount: -1 } },
        { $limit: 5 },
        {
          $project: {
            name: { $concat: ["$firstName", " ", "$lastName"] },
            rating: "$numericRating",
            ratedCount: 1,
            lessonsTaught: { $size: "$lessons" },
          },
        },
      ]),
    ]);

    // Calculate total lessons taught by all tutors
    const totalLessonsTaught = tutorLessonCounts.reduce(
      (sum: number, tutor: any) => sum + tutor.lessonCount,
      0
    );

    // Calculate total lessons learned by all learners
    const totalLessonsLearned = learnerLessonCounts.reduce(
      (sum: number, learner: any) => sum + learner.lessonCount,
      0
    );

    // Extract totalRatings and totalRatingCount from aggregation result
    const totalRatings = totalRatingsResult[0]?.total || 0;
    const totalRatingCount = totalRatingsResult[0]?.count || 0;

    // Calculate averages
    const avgLessonsTaught =
      tutorCount > 0 ? totalLessonsTaught / tutorCount : 0;
    const avgLessonsLearned =
      learnerCount > 0 ? totalLessonsLearned / learnerCount : 0;
    const avgTutorRating =
      totalRatingCount > 0 ? totalRatings / totalRatingCount : 0;

    // Calculate Lesson Distribution for Tutors
    const tutorDistribution = ranges.map((range) => {
      const count = tutorLessonCounts.filter(
        (tutor: any) =>
          tutor.lessonCount >= range.min && tutor.lessonCount <= range.max
      ).length;
      return { name: range.name, tutors: count, learners: 0 };
    });

    // Calculate Lesson Distribution for Learners
    const learnerDistribution = ranges.map((range) => {
      const count = learnerLessonCounts.filter(
        (learner: any) =>
          learner.lessonCount >= range.min && learner.lessonCount <= range.max
      ).length;
      return { name: range.name, tutors: 0, learners: count };
    });

    // Merge Tutor and Learner Distributions
    const lessonDistributionData = ranges.map((range, index) => ({
      name: range.name,
      tutors: tutorDistribution[index].tutors,
      learners: learnerDistribution[index].learners,
    }));

    // Identify learners with more than 31 bookings
    const learnersWithMoreThan31 = learnerLessonCounts
      .filter((learner: any) => learner.lessonCount > 31)
      .map((learner: any) => learner._id);

    if (learnersWithMoreThan31.length > 0) {
      console.log(
        "Learners with more than 31 bookings:",
        learnersWithMoreThan31
      );
    }

    // Process Top Countries and N/A Count
    const topCountries = topCountriesResult[0].topCountries;
    const naCount = topCountriesResult[0].naCount[0]?.naCount || 0;

    // Top rated users
    const topRatedTutors = topRatedTutorsResult;

    // Prepare the response
    const response: any = {
      userCardStats: {
        userCount,
        tutorCount,
        learnerCount,
        activeUserCount,
      },
      lessonStats: {
        avgLessonsTaught: parseFloat(avgLessonsTaught.toFixed(2)),
        avgLessonsLearned: parseFloat(avgLessonsLearned.toFixed(2)),
        avgTutorRating: parseFloat(avgTutorRating.toFixed(2)),
      },
      lessonDistributionData,
      top5CountriesWithMostUsers: topCountries,
      naCountryCount: naCount,
      topRatedTutors,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching user stats:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Lesson Stats
export const getLessonStats = async (req: Request, res: Response) => {
  try {
    // Use UTC to ensure consistency across different time zones
    const now = moment.utc();

    const topLessonsPromise = BookingModel.aggregate([
      {
        $group: {
          _id: "$lessonId",
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
      {
        $limit: 5,
      },
      {
        $lookup: {
          from: "lessons",
          localField: "_id",
          foreignField: "_id",
          as: "lessonDetails",
        },
      },
      {
        $unwind: "$lessonDetails",
      },
      {
        $project: {
          lessonName: "$lessonDetails.name",
          subject: "$lessonDetails.subject",
          count: 1,
        },
      },
    ]);

    const [
      totalSessions,
      sessions,
      totalLessonRequests,
      totalLessonsCompleted,
      totalLessonsRejected,
      totalActiveLessons,
      topLessons,
    ] = await Promise.all([
      // Total Sessions: Count all documents in the Session collection
      SessionModel.countDocuments({}),

      // Fetch all sessions
      SessionModel.find({}),

      // Total Lesson Requests: Count all documents in the Lesson collection
      BookingModel.countDocuments({}),

      // Total Lessons Completed: Assuming 'active: false' and 'status: "COMPLETED"'
      BookingModel.countDocuments({
        status: "COMPLETED",
      }),

      // Total Lessons Rejected: Assuming 'active: false' and 'status: "REJECTED"'
      BookingModel.countDocuments({
        status: "REJECTED",
      }),

      // Fetch all lessons to calculate average duration
      BookingModel.countDocuments({ status: "ACCEPTED" }),
      topLessonsPromise,
    ]);
    // Initialize counters for different session statuses
    let activeSessions = 0;
    let endedSessions = 0;
    let yetToStartSessions = 0;

    // Iterate over each session to determine its status
    sessions.forEach((session: any) => {
      const { startDate, startTime, sessionDuration } = session;

      // Ensure both startDate and startTime are present
      if (!startDate || !startTime) {
        console.warn(
          `Missing startDate or startTime for session ID: ${session._id}`
        );
        return; // Skip this session
      }

      // Parse startDate and startTime using the correct format
      // Expected format after concatenation: "YYYY-MM-DD HH:mm" e.g., "2024-08-21 14:00"
      const sessionStart = moment.utc(
        `${startDate} ${startTime}`,
        "YYYY-MM-DD HH:mm"
      );

      // Validate the parsed date
      if (!sessionStart.isValid()) {
        console.warn(`Invalid date/time format for session ID: ${session._id}`);
        return; // Skip this session
      }

      // Calculate the end time by adding sessionDuration minutes
      const sessionEnd = sessionStart.clone().add(sessionDuration, "minutes");

      // Determine the status based on the current time
      if (now.isBetween(sessionStart, sessionEnd)) {
        activeSessions += 1;
      } else if (now.isAfter(sessionEnd)) {
        endedSessions += 1;
      } else if (now.isBefore(sessionStart)) {
        yetToStartSessions += 1;
      }
    });

    // Calculate 'Others' count for lesson distribution
    const top5Count = topLessons.reduce((acc, lesson) => acc + lesson.count, 0);
    const othersCount = totalLessonRequests - top5Count;

    // Prepare lesson distribution data
    const lessonDistribution = [
      ...topLessons,
      {
        subject: "Others",
        count: othersCount,
      },
    ];

    const response = {
      sessionStats: {
        totalSessions,
        activeSessions,
        endedSessions,
        yetToStartSessions,
      },
      lessonStats: {
        totalLessonRequests,
        totalLessonsCompleted,
        totalLessonsRejected,
        totalActiveLessons,
      },
      topLessons,
      lessonDistribution,
    };

    // Send the response with a 200 status code
    res.status(200).json(response);
  } catch (error: any) {
    console.error("Error fetching lesson stats:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

interface PaymentStatsResponse {
  totalBookings: number;
  totalBookingsLastMonth: number;
  totalCreditPurchases: number;
  totalCreditPurchasesLastMonth: number;
}

export const getPaymentStats = async (req: Request, res: Response) => {
  try {
    // Define the start of the current and previous months
    const currentMonthStart = moment().startOf("month").toDate();
    const previousMonthStart = moment()
      .subtract(1, "months")
      .startOf("month")
      .toDate();
    const previousMonthEnd = moment()
      .subtract(1, "months")
      .endOf("month")
      .toDate();

    console.log("currentMonth", currentMonthStart);
    // 1. Total Bookings (Current Month)
    const totalBookingsPromise = TransactionModel.countDocuments({
      type: "BOOKING",
      createdAt: { $gte: currentMonthStart },
    });

    // 2. Total Bookings Last Month
    const totalBookingsLastMonthPromise = TransactionModel.countDocuments({
      type: "BOOKING",
      createdAt: { $gte: previousMonthStart, $lte: previousMonthEnd },
    });

    // 3. Total Credit Purchases (Current Month)
    const totalCreditPurchasesPromise = TransactionModel.aggregate([
      {
        $match: {
          type: "CREDIT_PURCHASE",
          createdAt: { $gte: currentMonthStart },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    // 4. Total Credit Purchases Last Month
    const totalCreditPurchasesLastMonthPromise = TransactionModel.aggregate([
      {
        $match: {
          type: "CREDIT_PURCHASE",
          createdAt: { $gte: previousMonthStart, $lte: previousMonthEnd },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    // Execute all promises concurrently
    const [
      totalBookings,
      totalBookingsLastMonth,
      totalCreditPurchasesResult,
      totalCreditPurchasesLastMonthResult,
    ] = await Promise.all([
      totalBookingsPromise,
      totalBookingsLastMonthPromise,
      totalCreditPurchasesPromise,
      totalCreditPurchasesLastMonthPromise,
    ]);

    // Extract total credit purchases, defaulting to 0 if no data is found
    const totalCreditPurchases = totalCreditPurchasesResult[0]?.total || 0;
    const totalCreditPurchasesLastMonth =
      totalCreditPurchasesLastMonthResult[0]?.total || 0;

    // Construct the response object
    const response: PaymentStatsResponse = {
      totalBookings,
      totalBookingsLastMonth,
      totalCreditPurchases,
      totalCreditPurchasesLastMonth,
    };

    console.log("response", response);
    // Send the response with a 200 status code
    res.status(200).json(response);
  } catch (error: any) {
    console.error("Error fetching payment stats:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getOverallStats = async (req: Request, res: Response) => {
  try {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    const lastMonthDate = new Date(currentDate);
    lastMonthDate.setMonth(currentMonth - 1);
    const lastMonth = lastMonthDate.getMonth();
    const lastYear = lastMonthDate.getFullYear();

    const calculateRevenue = async (month: number, year: number) => {
      const result = await TransactionModel.aggregate([
        {
          $match: {
            $and: [
              {
                type: { $in: ["CREDIT_PURCHASE", "BOOKING"] },
              },
              {
                paymentMethod: "CARD",
              },
              {
                $expr: {
                  $and: [
                    { $eq: [{ $month: "$createdAt" }, month + 1] },
                    { $eq: [{ $year: "$createdAt" }, year] },
                  ],
                },
              },
            ],
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$amount" },
          },
        },
      ]);
      return result[0]?.totalRevenue || 0;
    };

    const [currentRevenue, lastRevenue] = await Promise.all([
      calculateRevenue(currentMonth, currentYear),
      calculateRevenue(lastMonth, lastYear),
    ]);

    let percentageChange = 0;
    if (lastRevenue !== 0) {
      percentageChange = ((currentRevenue - lastRevenue) / lastRevenue) * 100;
    } else {
      percentageChange = currentRevenue > 0 ? 100 : 0;
    }

    res.status(200).json({
      totalRevenue: currentRevenue,
      percentageChange: percentageChange.toFixed(2),
    });
  } catch (error) {
    console.error("Error fetching overall stats:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
