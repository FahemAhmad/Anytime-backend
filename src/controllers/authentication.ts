import {
  UserModel,
  createNewOtpByExpiry,
  createUser,
  getUsersByEmail,
  updateUserById,
} from "../db/users";
import express from "express";
import { authentication, generateOTP, isOtpExpired, random } from "../helpers";
import { sendOTP } from "../helpers/mail";
import {
  getUserDetailsFromRedis,
  saveUserDetailsToRedis,
} from "../lib/redisService";

export const register = async (req: express.Request, res: express.Response) => {
  try {
    const { email, username, password, firstName, surName } = req.body;

    if (!email || !username || !password || !firstName || !surName) {
      return res.status(400).json({
        message: "Invalid user details",
      });
    }

    const existingUser = await getUsersByEmail(email);

    if (existingUser)
      return res.status(409).json({ message: "Email already exists" });

    // Generate OTP
    const otp = generateOTP();

    const expiryDurationInMinutes = 2;
    const otpExpiryTime = new Date(
      Date.now() + expiryDurationInMinutes * 60000
    );

    try {
      await sendOTP(email, otp);
    } catch (error) {
      console.error("Error sending OTP email:", error);
      return res.status(500).json({ message: "Error sending OTP email" });
    }

    const salt = random();
    const user = await createUser({
      firstName,
      lastName: surName,
      username,
      email,
      authentication: {
        salt,
        password: authentication(salt, password),
      },
      otp,
      otpExpiryTime,
    });

    await saveUserDetailsToRedis(user._id.toString(), user);
    delete user["otp"];
    return res
      .status(200)
      .json({ ...user, otpExpiryDuration: expiryDurationInMinutes })
      .end();
  } catch (err) {
    console.log(err);
    return res.status(400).json({
      message: "Error connecting to server",
    });
  }
};

export const login = async (req: express.Request, res: express.Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Invalid user credentials" });

    const user: any = await getUsersByEmail(email).select(
      "+authentication.salt +authentication.password"
    );

    if (user && !user.isVerified) {
      return res.status(409).json({ message: "Email is not verified" });
    }
    if (user && user.provider !== "email")
      return res
        .status(409)
        .json({ message: "User is registered with other provider" });

    if (!user) return res.status(404).json({ message: "User Not Found" });

    const expectedHash = authentication(user.authentication.salt, password);

    if (user.authentication.password !== expectedHash)
      return res.status(403).json({
        message: "Invalid Credentials",
      });

    const salt = random();
    user.authentication.sessionToken = authentication(
      salt,
      user._id.toString()
    );

    await user.save();

    //check if user exists else save it to redis
    const r = await getUserDetailsFromRedis(user._id.toString());
    if (!r) await saveUserDetailsToRedis(user._id.toString(), user);
    return res
      .status(200)
      .json({ ...user, sessionToken: user.authentication.sessionToken });
  } catch (err) {
    console.log("err", err);
    console.log("reached phase 5");
    return res.status(400).json({
      message: "Error connecting to server",
    });
  }
};

export const verifyOTP = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp)
      return res.status(400).json({ message: "Invalid Data" });

    const user: any = await getUsersByEmail(email).select(
      "+authentication.salt +authentication.password"
    );

    if (!user) return res.status(404).json({ message: "User Not Found" });

    if (isOtpExpired(user.otpExpiryTime))
      return res.status(403).json({
        message: "Otp is expired",
      });

    if (user.otp !== Number(otp))
      return res.status(403).json({
        message: "Invalid otp",
      });

    const salt = random();
    user.authentication.sessionToken = authentication(
      salt,
      user._id.toString()
    );

    user.isVerified = true;
    user.isOtpVerified = true;

    await user.save();

    return res.status(200).json(user).end();
  } catch (err) {
    return res.status(400).json({
      message: "Error connecting to server",
    });
  }
};

export const forgotPassword = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { email } = req.body;

    if (!email) return res.status(400).json({ message: "Invalid Data" });

    const user: any = await getUsersByEmail(email);

    if (!user) return res.status(404).json({ message: "User Not Found" });

    const otp = generateOTP();
    const expiryDurationInMinutes = 2;

    await createNewOtpByExpiry(user._id, otp, expiryDurationInMinutes);

    try {
      await sendOTP(email, otp.toString());
    } catch (error) {
      console.error("Error sending OTP email:", error);
      return res.status(500).json({ message: "Error sending OTP email" });
    }

    return res
      .status(200)
      .json({ otpExpiryDuration: expiryDurationInMinutes })
      .end();
  } catch (err) {
    console.log("err", err);
    return res.status(400).json({
      message: "Error connecting to server",
    });
  }
};

export const updatePassword = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Invalid Data" });

    const user: any = await getUsersByEmail(email).select(
      "+authentication.salt +authentication.password"
    );

    if (!user) return res.status(404).json({ message: "User Not Found" });

    user.authentication.password = authentication(
      user.authentication.salt,
      password
    );

    delete user.otp;
    delete user.otpExpiryTime;

    await user.save();

    return res.status(200).json(user).end();
  } catch (err) {
    console.log("err", err);
    return res.status(400).json({
      message: "Error connecting to server",
    });
  }
};

export const oauthLogin = async (
  req: express.Request,
  res: express.Response
) => {
  const { providerName: provider } = req.params;
  let { token } = req.body;

  if (!token) {
    return res.status(400).json({ message: "Token is required" });
  }

  let userinfoUrl;

  if (provider === "google") {
    userinfoUrl = "https://www.googleapis.com/userinfo/v2/me";
  } else if (provider === "fb") {
    userinfoUrl = `https://graph.facebook.com/me?access_token=${token}&fields=id,name,picture.type(large),email`;
  } else {
    return res.status(400).json({ message: "Invalid provider" });
  }

  try {
    const response = await fetch(userinfoUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to authenticate");
    }

    const userData = await response.json();

    const existingUser = await getUsersByEmail(userData.email);

    if (!userData.email) {
      return res.status(400).json({ message: "Email is required" });
    }
    if (existingUser && existingUser.provider != provider) {
      return res.status(409).json({
        message: `User registered with other provider`,
      });
    }

    if (existingUser) return res.status(200).json(existingUser);

    let username = "",
      firstName = "",
      lastName = "",
      email = "",
      authentication = {
        salt: "",
        password: "",
        sessionToken: token,
      },
      avatarUrl: "",
      otp = "",
      otpExpiryTime = "",
      isOtpVerified = true,
      isVerified = true;

    if (provider == "google") {
      const userName = `${userData.given_name.charAt(0)}${
        userData.family_name
      }`?.toLowerCase();
      username = `${userName}${Date.now()}`;

      firstName = userData?.given_name;
      lastName = userData?.family_name;
      avatarUrl = userData?.picture;
    } else if (provider == "fb") {
      const userName = `${userData.name.charAt(0)}${
        userData.name
      }`?.toLowerCase();

      username = `${userName}${Date.now()}`;
      firstName = userData?.name;
      avatarUrl = userData?.picture?.data?.url;
    }

    email = userData?.email;

    const newUser = await createUser({
      firstName,
      lastName,
      username,
      email: email,
      authentication,
      otp,
      avatarUrl: avatarUrl,
      otpExpiryTime,
      isOtpVerified,
      isVerified,
      provider,
    });

    return res.status(200).json(newUser);
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
