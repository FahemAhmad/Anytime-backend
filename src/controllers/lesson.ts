import { getUserById } from "../db/users";
import {
  createNewLessonDb,
  deleteLessonByIdDb,
  getOfferedLessonsDb,
} from "../db/lesson";
import express from "express";

//create a new lesson
export const createNewLesson = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    // create new lesson

    const body = req.body;

    const newLesson = await createNewLessonDb({
      ...body,
      tutor: (req as any).identity._id,
    });

    // save lesson to user table
    const user: any = await getUserById((req as any).identity._id);

    user.lessons.push(newLesson._id);

    await user.save();

    return res.status(200).json(newLesson);
  } catch (err: any) {
    console.log("error", err);
    return res.status(500).json({ error: err.message });
  }
};

//get all offered lessons
export const getOfferedLessons = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const lessons = await getOfferedLessonsDb((req as any).identity._id);
    return res.status(200).json({ data: lessons });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

//delete lesson offering
export const deleteOffering = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { lessonId } = req.body;
    const user: any = await getUserById((req as any).identity._id);

    const lesson = await deleteLessonByIdDb(lessonId);

    const index = user.lessons.indexOf(lessonId);

    if (index > -1) {
      user.lessons.splice(index, 1);
    }

    await user.save();

    return res.status(200).json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const getBookedLessonsOfuser = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    //from bookings also, populate lessons
    const user: any = await getUserById((req as any).identity._id).populate({
      path: "bookings",
      populate: [
        { path: "lessonId" },
        {
          path: "userId",
          select:
            "username firstName lastName _id email ratings ratedCount followers following university expertise introduction country ",
        },
        {
          path: "tutorId",
          select:
            "username firstName lastName _id email ratings ratedCount followers following university expertise introduction country ",
        },
      ],
    });


    return res.status(200).json({ data: user.bookings });
  } catch (err: any) {
    console.log("err", err);
    return res.status(500).json({ error: err.message });
  }
};
