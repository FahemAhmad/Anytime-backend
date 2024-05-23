import express from "express";

import { getUsers, searchUserByEmail } from "../db/users";

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
    console.log("email");

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
