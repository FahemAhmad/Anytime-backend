import { getUserBySessionToken } from "../db/users";
import express from "express";
import { get, merge } from "lodash";

export const isAuthenticated = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  try {
    const sessionToken = req?.headers?.authorization?.split(" ")?.[1];

    if (!sessionToken) return res.sendStatus(403);

    const existingUser = await getUserBySessionToken(sessionToken);

    if (!existingUser) return res.sendStatus(403);

    merge(req, { identity: existingUser });

    return next();
  } catch (error) {
    return res.sendStatus(400);
  }
};
