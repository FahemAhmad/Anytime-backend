import express from "express";
import {
  UserModel,
  getUserById,
  getUsers,
  searchUserByEmail,
} from "../db/users";

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

export const searchUsersByEmail = async (
  req: express.Request & { identity: any },
  res: express.Response
) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const users = await searchUserByEmail(email as string, req.identity._id);

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
    const userBeingFollowed = await getUserById(userToFollow);

    if (isFollow) {
      if (userFollowing?.following) {
        if (!userFollowing.following.includes(userBeingFollowed._id)) {
          userFollowing.following.push(userBeingFollowed._id);
        }
      } else {
        userFollowing.following = [userBeingFollowed._id];
      }

      if (userBeingFollowed?.followers) {
        if (!userBeingFollowed.followers.includes(userFollowing._id)) {
          userBeingFollowed.followers.push(userFollowing._id);
        }
      } else {
        userBeingFollowed.followers = [userFollowing._id];
      }
    } else {
      if (userFollowing?.following) {
        const index = userFollowing.following.indexOf(userBeingFollowed._id);
        if (index > -1) {
          userFollowing.following.splice(index, 1);
        }
      }

      if (userBeingFollowed?.followers) {
        const index = userBeingFollowed.followers.indexOf(userFollowing._id);
        if (index > -1) {
          userBeingFollowed.followers.splice(index, 1);
        }
      }
    }

    await userBeingFollowed.save();
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
