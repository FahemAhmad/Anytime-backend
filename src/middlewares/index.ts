import { getUserBySessionToken, UserModel } from "../db/users";

import { Request, Response, NextFunction } from "express";
import { merge } from "lodash";

declare global {
  namespace Express {
    interface Request {
      user?: any; // Replace `any` with your User interface if available
    }
  }
}

export const isAuthenticated = async (
  req: Request,
  res: Response,
  next: NextFunction
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

export const authenticateAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Extract session token from HTTP-only cookies
    const sessionToken = req.cookies.sessionToken;

    if (!sessionToken) {
      return res
        .status(401)
        .json({ message: "Unauthorized: No session token provided" });
    }

    // Find the user associated with the session token
    const user = await UserModel.findOne({
      "authentication.sessionToken": sessionToken,
    });

    if (!user) {
      return res
        .status(401)
        .json({ message: "Unauthorized: Invalid session token" });
    }

    if (
      user.authentication.sessionExpiry &&
      user.authentication.sessionExpiry < new Date()
    ) {
      return res
        .status(401)
        .json({ message: "Unauthorized: Session has expired" });
    }

    // Check if the user has an admin or superadmin role
    if (!["admin", "superadmin"].includes(user.role)) {
      return res.status(403).json({ message: "Forbidden: Admins only" });
    }

    // Attach the user to the request object
    req.user = user;

    // Proceed to the next middleware or route handler
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    return res
      .status(500)
      .json({ message: "Server error during authentication" });
  }
};
