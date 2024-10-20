// src/controllers/statsController.js

import { SessionModel } from "../db/session";
import { BookingModel } from "../db/booking";
import { UserModel } from "../db/users";
import { Request, Response } from "express";
import moment from "moment";
import { TransactionModel } from "../db/transactions";
import { FeedbackModel } from "../db/feedback";

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
    const currentDate = new Date();
    const currentISODate = currentDate.toISOString();

    const topLessonsSubjectPromise = BookingModel.aggregate([
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

    const topLessonsPromise = await BookingModel.aggregate([
      // Stage 1: Filter out bookings with status 'UNPAID' or 'REJECTED'
      {
        $match: {
          status: { $nin: ["UNPAID", "REJECTED"] },
        },
      },
      // Stage 2: Group by lessonId to calculate total bookings and average rating
      {
        $group: {
          _id: "$lessonId",
          bookedCount: { $sum: 1 },
          averageRating: { $avg: "$ratingDetails.rating" },
        },
      },
      // Stage 3: Sort by bookedCount in descending order
      {
        $sort: { bookedCount: -1 },
      },
      // Stage 4: Limit to top 5 lessons
      {
        $limit: 5,
      },
      // Stage 5: Lookup to fetch lesson details
      {
        $lookup: {
          from: "lessons", // Ensure this matches the actual collection name
          localField: "_id",
          foreignField: "_id",
          as: "lesson",
        },
      },
      // Stage 6: Unwind the lesson array
      {
        $unwind: "$lesson",
      },
      // Stage 7: Lookup to fetch tutor details from User collection
      {
        $lookup: {
          from: "users", // Ensure this matches the actual collection name
          localField: "lesson.tutor",
          foreignField: "_id",
          as: "tutor",
        },
      },
      // Stage 8: Unwind the tutor array
      {
        $unwind: "$tutor",
      },
      // Stage 9: Project the desired fields
      {
        $project: {
          _id: 0,
          lessonId: "$_id",
          subject: "$lesson.subject",
          topic: "$lesson.topic",
          price: "$lesson.price",
          bookedCount: 1,
          averageRating: {
            $cond: {
              if: { $ifNull: ["$averageRating", false] },
              then: { $round: ["$averageRating", 2] },
              else: "N/A",
            },
          },
          tutor: {
            username: "$tutor.username",
            firstName: "$tutor.firstName",
            lastName: "$tutor.lastName",
          },
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
      topSubject,
      topLessons,
      topSessionsApiResponse,
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
      topLessonsSubjectPromise,
      topLessonsPromise,
      SessionModel.find({
        $or: [
          { startDate: { $lt: currentISODate.split("T")[0] } }, // Sessions before today's date
          {
            startDate: { $eq: currentISODate.split("T")[0] }, // Sessions today, but ended
          },
        ],
      })
        .sort({ viewersCount: -1 }) // Sort by viewers count in descending order
        .limit(5) // Limit to top 5 sessions
        .populate({
          path: "tutor",
          select: "firstName lastName username",
        })
        .populate("ratings")
        .select(
          "sessionUrl topic subject sessionDuration viewersCount description startDate startTime _id"
        ),
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
    const top5Count = topSubject.reduce((acc, lesson) => acc + lesson.count, 0);
    const othersCount = totalLessonRequests - top5Count;

    // Prepare lesson distribution data
    const lessonDistribution = [
      ...topSubject,
      {
        subject: "Others",
        count: othersCount,
      },
    ];

    // top 5 sessions
    const finishedSessions = topSessionsApiResponse.filter((session) => {
      // Combine startDate and startTime to create the full start datetime
      const sessionStart = moment(session.startDate).set({
        hour: parseInt(session.startTime.split(":")[0]),
        minute: parseInt(session.startTime.split(":")[1]),
      });

      // Calculate the end time by adding the session duration (in minutes)
      const sessionEnd = sessionStart
        .clone()
        .add(session.sessionDuration, "minutes");

      // Compare session end time with the current time
      return sessionEnd.isBefore(moment());
    });

    const topSessions = finishedSessions.map((session: any) => ({
      sessionId: session._id,
      sessionUrl: session.sessionUrl,
      topic: session.topic,
      subject: session.subject,
      tutorName: `${session.tutor.firstName} ${session.tutor.lastName}`,
      tutorUsername: session.tutor.username,
      viewersCount: session.viewersCount,
      rating: session.ratings ? session.ratings.rating : "No rating", // Check if ratings exist
      description: session.description,
      sessionDuration: session.sessionDuration,
      sessionDayTime: `${session.startDate.split("T")[0]} ${session.startTime}`, // Combine date and time for session display
    }));

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
      lessonDistribution,
      topLessons,
      topSessions,
    };

    // Send the response with a 200 status code
    res.status(200).json(response);
  } catch (error: any) {
    console.error("Error fetching lesson stats:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getPaymentStats = async (req: Request, res: Response) => {
  try {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const statsApi = TransactionModel.aggregate([
      {
        $facet: {
          totalAmountTransacted: [
            { $group: { _id: null, total: { $sum: "$amount" } } },
          ],
          totalCreditsPurchased: [
            { $match: { type: "CREDIT_PURCHASE" } },
            { $group: { _id: null, total: { $sum: "$amount" } } },
          ],
          totalAmountWithdrawn: [
            { $match: { type: "WITHDRAWAL" } },
            { $group: { _id: null, total: { $sum: { $abs: "$amount" } } } },
          ],
          paymentMethodBreakdown: [
            { $group: { _id: "$paymentMethod", count: { $sum: 1 } } },
          ],
        },
      },
    ]);

    const transactionsApi = TransactionModel.aggregate([
      {
        $match: {
          createdAt: { $gte: oneYearAgo },
        },
      },
      {
        $project: {
          month: { $month: "$createdAt" },
          year: { $year: "$createdAt" },
          amount: { $abs: "$amount" },
          type: "$type",
        },
      },
      {
        $group: {
          _id: { month: "$month", year: "$year", type: "$type" },
          totalAmount: { $sum: "$amount" },
        },
      },
      {
        $group: {
          _id: { month: "$_id.month", year: "$_id.year" },
          added: {
            $sum: {
              $cond: [
                { $in: ["$_id.type", ["BOOKING", "CREDIT_PURCHASE"]] },
                "$totalAmount",
                0,
              ],
            },
          },
          withdrawn: {
            $sum: {
              $cond: [
                { $in: ["$_id.type", ["WITHDRAWAL", "CREDIT_DEDUCTION"]] },
                "$totalAmount",
                0,
              ],
            },
          },
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 },
      },
    ]);

    const distributionApi = TransactionModel.aggregate([
      {
        $group: {
          _id: "$type",
          amount: { $sum: { $abs: "$amount" } },
        },
      },
    ]);

    const [stats, transactions, distribution] = await Promise.all([
      statsApi,
      transactionsApi,
      distributionApi,
    ]);

    const trendData = [];
    const currentDate = new Date();
    let currentMonth = oneYearAgo.getMonth() + 1;
    let currentYear = oneYearAgo.getFullYear();

    while (
      currentYear < currentDate.getFullYear() ||
      (currentYear === currentDate.getFullYear() &&
        currentMonth <= currentDate.getMonth() + 1)
    ) {
      const existingData = transactions.find(
        (t) => t._id.year === currentYear && t._id.month === currentMonth
      );

      if (existingData) {
        trendData.push(existingData);
      } else {
        trendData.push({
          _id: { month: currentMonth, year: currentYear },
          added: 0,
          withdrawn: 0,
        });
      }

      currentMonth++;
      if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
      }
    }

    const result = {
      totalAmountTransacted: stats[0].totalAmountTransacted[0]?.total || 0,
      totalCreditsPurchased: stats[0].totalCreditsPurchased[0]?.total || 0,
      totalAmountWithdrawn: stats[0].totalAmountWithdrawn[0]?.total || 0,
      paymentMethodBreakdown: stats[0].paymentMethodBreakdown.reduce(
        (acc: any, curr: any) => {
          acc[curr._id] = curr.count;
          return acc;
        },
        {}
      ),
      trendData,
      distribution,
    };

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getOverallStats = async (req: Request, res: Response) => {
  try {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth(); // 0-indexed
    const currentYear = currentDate.getFullYear();

    const lastYearFull = new Date(
      currentDate.getFullYear() - 1,
      currentDate.getMonth(),
      currentDate.getDate()
    );

    // Calculate last month
    const lastMonthDate = new Date(currentDate);
    lastMonthDate.setMonth(currentMonth - 1);
    const lastMonth = lastMonthDate.getMonth();
    const lastYear = lastMonthDate.getFullYear();

    // Define date ranges
    const currentMonthStart = new Date(currentYear, currentMonth, 1);
    const startOfNextMonth = new Date(currentYear, currentMonth + 1, 1);

    // Define one year ago date
    const oneYearAgo = new Date(currentYear - 1, currentMonth, 1);

    // Helper function to calculate revenue
    const calculateRevenue = async (matchCriteria: any): Promise<number> => {
      const result = await TransactionModel.aggregate([
        { $match: matchCriteria },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$amount" },
          },
        },
      ]);
      return result[0]?.totalRevenue || 0;
    };

    // Aggregations for booking statuses
    const aggregateBookingStatuses = async (
      matchCriteria: any
    ): Promise<{ _id: string; count: number }[]> => {
      const result = await BookingModel.aggregate([
        { $match: { ...matchCriteria, createdAt: { $ne: null } } },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]);
      return result;
    };

    // Fetch all required data in parallel
    const [
      currentRevenue,
      lastRevenue,
      totalUsers,
      totalRevenueAllTime,
      usersIncrease,
      bugFeedbacks, // number of bugs
      bugFeedbacksLastMonth,
      unattendedBugFeedbacks,
      completedBookings, // total completed bookings
      completedBookingsThisMonth,
      monthlyRevenue,
      recentAccounts,
      feedbackCountsLastYear, // Aggregation for last 1 year feedback counts
      feedbackCountsThisMonth,
      bookingStatusesCurrentMonth, // Current month booking statuses
      sessionTrendsApi,
    ] = await Promise.all([
      calculateRevenue({
        type: { $in: ["CREDIT_PURCHASE", "BOOKING"] },
        paymentMethod: "CARD",
        $expr: {
          $and: [
            { $eq: [{ $month: "$createdAt" }, currentMonth + 1] },
            { $eq: [{ $year: "$createdAt" }, currentYear] },
          ],
        },
      }),
      calculateRevenue({
        type: { $in: ["CREDIT_PURCHASE", "BOOKING"] },
        paymentMethod: "CARD",
        $expr: {
          $and: [
            { $eq: [{ $month: "$createdAt" }, lastMonth + 1] },
            { $eq: [{ $year: "$createdAt" }, lastYear] },
          ],
        },
      }),
      UserModel.countDocuments(),
      calculateRevenue({
        type: { $in: ["CREDIT_PURCHASE", "BOOKING"] },
        paymentMethod: "CARD",
      }),
      UserModel.countDocuments({
        createdAt: { $gte: currentMonthStart, $lt: startOfNextMonth },
      }),
      FeedbackModel.countDocuments({
        type: "problem",
      }),
      FeedbackModel.countDocuments({
        type: "problem",
        createdAt: {
          $gte: new Date(lastYear, lastMonth, 1),
          $lt: new Date(lastYear, lastMonth + 1, 1),
        },
      }),
      FeedbackModel.countDocuments({
        type: "problem",
        resolved: false,
      }),
      BookingModel.countDocuments({
        status: "DELIVERED",
      }),
      BookingModel.countDocuments({
        status: "DELIVERED",
        createdAt: { $gte: currentMonthStart, $lt: startOfNextMonth },
      }),
      TransactionModel.aggregate([
        {
          $match: {
            type: { $in: ["CREDIT_PURCHASE", "BOOKING"] },
            paymentMethod: "CARD",
            createdAt: {
              $gte: new Date(currentYear, currentMonth - 11, 1), // Last 12 months
              $lt: startOfNextMonth,
            },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
            },
            totalRevenue: { $sum: "$amount" },
          },
        },
        {
          $sort: { "_id.year": 1, "_id.month": 1 },
        },
      ]),
      UserModel.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select("firstName lastName email avatarUrl createdAt status"),

      FeedbackModel.aggregate([
        {
          $match: {
            createdAt: {
              $gte: oneYearAgo,
              $lt: currentDate,
            },
          },
        },
        { $group: { _id: "$type", count: { $sum: 1 } } },
      ]),
      FeedbackModel.aggregate([
        {
          $match: {
            createdAt: {
              $gte: currentMonthStart,
              $lt: startOfNextMonth,
            },
          },
        },
        { $group: { _id: "$type", count: { $sum: 1 } } },
      ]),
      aggregateBookingStatuses({
        createdAt: { $gte: currentMonthStart, $lt: startOfNextMonth },
      }),
      // Get session counts of last 12 months
      SessionModel.aggregate([
        {
          $match: {
            createdAt: { $gte: lastYearFull, $lte: currentDate },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        {
          $sort: { "_id.year": 1, "_id.month": 1 },
        },
        {
          $project: {
            _id: 0,
            year: "$_id.year",
            month: "$_id.month",
            count: 1,
          },
        },
      ]),
    ]);

    // Session trends
    const formattedSessionTrends = sessionTrendsApi.map((session) => ({
      month: `${session.year}-${String(session.month).padStart(2, "0")}`,
      count: session.count,
    }));

    // Format monthly revenue data
    const formattedMonthlyRevenue = monthlyRevenue.map((item: any) => ({
      month: `${item._id.month}/${item._id.year}`,
      revenue: item.totalRevenue,
    }));

    // Calculate percentage change in revenue
    let percentageChange = 0;
    if (lastRevenue !== 0) {
      percentageChange = ((currentRevenue - lastRevenue) / lastRevenue) * 100;
    } else {
      percentageChange = currentRevenue > 0 ? 100 : 0;
    }

    // Process feedback distribution
    const bugsLastYear =
      feedbackCountsLastYear.find((f: any) => f._id === "problem")?.count || 0;
    const helpLastYear =
      feedbackCountsLastYear.find((f: any) => f._id === "help")?.count || 0;
    const feedbackLastYear =
      feedbackCountsLastYear.find((f: any) => f._id === "feedback")?.count || 0;

    const bugsThisMonth =
      feedbackCountsThisMonth.find((f: any) => f._id === "problem")?.count || 0;
    const helpThisMonth =
      feedbackCountsThisMonth.find((f: any) => f._id === "help")?.count || 0;
    const feedbackThisMonth =
      feedbackCountsThisMonth.find((f: any) => f._id === "feedback")?.count ||
      0;

    // Process booking statuses for current month
    const bookingStatuses: Record<string, number> =
      bookingStatusesCurrentMonth.reduce((acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {} as Record<string, number>);

    // Prepare booking distribution data
    const bookingDistribution = [
      {
        status: "Delivered",
        count: bookingStatuses["DELIVERED"] || 0,
        fill: "#4caf50", // Green
      },
      {
        status: "Pending",
        count: bookingStatuses["PENDING"] || 0,
        fill: "#ff9800", // Orange
      },
      {
        status: "Rejected",
        count: bookingStatuses["REJECTED"] || 0,
        fill: "#f44336", // Red
      },
      {
        status: "Accepted",
        count: bookingStatuses["ACCEPTED"] || 0,
        fill: "#2196f3", // Blue
      },
      {
        status: "Completed",
        count: bookingStatuses["COMPLETED"] || 0,
        fill: "#4cafaf", // Green (same as Delivered)
      },
      {
        status: "Unpaid",
        count: bookingStatuses["UNPAID"] || 0,
        fill: "#9e9e9e", // Grey
      },
    ];

    // Calculate total bookings all time with all statuses
    const totalBookingsAllTime: number = await BookingModel.countDocuments({
      status: {
        $in: [
          "DELIVERED",
          "PENDING",
          "REJECTED",
          "ACCEPTED",
          "COMPLETED",
          "UNPAID",
        ],
      },
    });

    // Send the response
    res.status(200).json({
      percentageChange: percentageChange.toFixed(2),
      totalUsers: totalUsers,
      totalRevenueAllTime: totalRevenueAllTime,
      usersIncrease: usersIncrease,
      bugFeedbacks: bugFeedbacks,
      bugFeedbacksLastMonth: bugFeedbacksLastMonth,
      unattendedBugFeedbacks: unattendedBugFeedbacks,
      completedBookings: completedBookings,
      completedBookingsThisMonth: completedBookingsThisMonth,
      monthlyRevenue: formattedMonthlyRevenue,
      recentAccounts: recentAccounts,
      feedbackDistributionLastYear: {
        bugs: bugsLastYear,
        help: helpLastYear,
        feedback: feedbackLastYear,
      },
      feedbackDistributionThisMonth: {
        bugs: bugsThisMonth,
        help: helpThisMonth,
        feedback: feedbackThisMonth,
      },
      bookingDistribution, // New field: Booking statuses breakdown
      totalBookingsAllTime, // New field: Total bookings all time
      sessionTrends: formattedSessionTrends,
    });
  } catch (error) {
    console.error("Error fetching overall stats:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const testSession = async (req: Request, res: Response) => {};
