import {
  UserModel,
  createNewOtpByExpiry,
  createUser,
  getUserByEmailOrUsername,
  getUserById,
  getUsersByEmail,
} from "../db/users";
import express from "express";
import {
  authentication,
  generateOTP,
  generateRandomUsername,
  isOtpExpired,
  random,
} from "../helpers";
import { sendOTP } from "../helpers/mail";

export const register = async (req: express.Request, res: express.Response) => {
  try {
    const { email, username, password, firstName, surName } = req.body;

    if (!email || !username || !password || !firstName || !surName) {
      return res.status(400).json({
        message: "Invalid user details",
      });
    }

    const existingUser = await getUserByEmailOrUsername(email, username);

    if (existingUser && existingUser.email === email)
      return res.status(409).json({
        message: "Another account is already associated with this email",
      });

    if (existingUser && existingUser.username === username)
      return res.status(409).json({
        message: "Username is taken",
      });

    // Generate OTP
    const otp = generateOTP();

    const expiryDurationInMinutes = 2;
    const otpExpiryTime = new Date(
      Date.now() + expiryDurationInMinutes * 60000
    );

    try {
      await sendOTP(email, otp);
    } catch (error) {
      return res
        .status(500)
        .json({ message: "Error sending OTP email. Please retry later." });
    }

    const salt = random();
    const user: any = await createUser({
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

    user._doc = { ...user._doc, otpExpiryDuration: expiryDurationInMinutes };

    delete user["otp"];
    return res
      .status(200)
      .json({ ...user })
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

    if (user && !user?.status) {
      return res
        .status(403)
        .json({ message: "User account is blocked. Please contact support." });
    }

    if (user && !user.isVerified) {
      try {
        const otp = generateOTP();

        const expiryDurationInMinutes = 2;
        const otpExpiryTime = new Date(
          Date.now() + expiryDurationInMinutes * 60000
        );

        user.otpExpiryTime = otpExpiryTime;
        user.otp = Number(otp);

        await user.save();
        await sendOTP(email, otp);
      } catch (error) {
        return res.status(500).json({
          message:
            "Email is not verified. Error sending OTP email for verification. Please retry later.",
        });
      }

      return res.status(409).json({ message: "Email is not verified" });
    }

    if (user && user.provider !== "email")
      return res
        .status(409)
        .json({ message: "User is registered with other provider" });

    if (!user) return res.status(404).json({ message: "Invalid Credentials" });

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

    return res
      .status(200)
      .json({ ...user, sessionToken: user.authentication.sessionToken });
  } catch (err) {
    console.log("err", err);
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
      console.error("Error sending OTP email 3:", error);
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
      avatarUrl = "",
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

export const resendOtp = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await getUsersByEmail(email);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user && user.provider !== "email") {
      return res
        .status(409)
        .json({ message: "User is registered with other provider" });
    }

    const otp = generateOTP();

    const expiryDurationInMinutes = 2;
    const otpExpiryTime = new Date(
      Date.now() + expiryDurationInMinutes * 60000
    );
    user.otpExpiryTime = otpExpiryTime;

    user.otp = Number(otp);

    try {
      await sendOTP(email, otp);
    } catch (error) {
      console.error("Error sending OTP email 4:", error);
      return res.status(500).json({ message: "Error sending OTP email" });
    }

    // Save updated user details to Redis
    await user.save();

    return res
      .status(200)
      .json({ ...user, otpExpiryDuration: expiryDurationInMinutes })
      .end();
  } catch (err) {
    console.error("Error in resendOtp:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const changePassword = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = (req as any)?.identity._id;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: "Invalid Data" });
    }

    const user: any = await getUserById(userId).select(
      "+authentication.salt +authentication.password"
    );

    if (!user) {
      return res.status(404).json({ message: "User Not Found" });
    }

    // Verify old password
    const oldPasswordHash = authentication(
      user.authentication.salt,
      oldPassword
    );
    if (user.authentication.password !== oldPasswordHash) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    // Update password
    user.authentication.password = authentication(
      user.authentication.salt,
      newPassword
    );

    await user.save();

    return res.status(200).json({ message: "Password changed successfully" });
  } catch (err) {
    console.log("err", err);
    return res.status(400).json({
      message: "Error connecting to server",
    });
  }
};

export const adminLogin = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Invalid user credentials" });
    }

    // Retrieve user by email and include password and salt fields
    const user: any = await UserModel.findOne({ email }).select(
      "+authentication.salt +authentication.password"
    );

    if (!user) {
      return res.status(404).json({ message: "User Not Found" });
    }

    if (user && !user.isVerified) {
      return res.status(409).json({ message: "Email is not verified" });
    }

    if (user && user.provider !== "email") {
      return res
        .status(409)
        .json({ message: "User is registered with another provider" });
    }

    // Check if the user is an admin or superadmin
    if (!["admin", "superadmin"].includes(user.role)) {
      return res.status(403).json({ message: "Access denied. Admins only." });
    }

    // Validate the password
    const expectedHash = authentication(user.authentication.salt, password);
    if (user.authentication.password !== expectedHash) {
      return res.status(403).json({
        message: "Invalid Credentials",
      });
    }

    // Generate new session token and expiry
    const salt = random();
    const sessionToken = authentication(salt, user._id.toString());
    const sessionExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // Set expiry time to 24 hours

    // Save session token and expiry in the user object
    user.authentication.sessionToken = sessionToken;
    user.authentication.sessionExpiry = sessionExpiry;
    await user.save();

    // Set the session token as an HTTP-only cookie
    res.cookie("sessionToken", sessionToken, {
      httpOnly: true,
      domain: "localhost",
      secure: process.env.NODE_ENV !== "development", // Use secure cookies in production
      sameSite: "none", // Adjust as needed
      maxAge: 24 * 60 * 60 * 1000, // 1 day
      // path: "/",
    });

    // Send back the user info without sessionToken (since it's in the cookie)
    return res.status(200).json({
      id: user._id,
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl || "",
    });
  } catch (err) {
    console.log("Error during login:", err);
    return res.status(500).json({
      message: "Error connecting to server",
    });
  }
};

export const createAdmin = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    // Check if all required fields are provided
    if (!email || !password || !firstName || !lastName) {
      return res
        .status(400)
        .json({ message: "Email, password, and name are required." });
    }

    // Check if the email already exists
    const existingUser = await UserModel.findOne({ email });
    if (existingUser) {
      return res
        .status(409)
        .json({ message: "User with this email already exists." });
    }

    // Generate a random username for the admin
    let username = generateRandomUsername(`${firstName} ${lastName}`);

    // Ensure the generated username is unique
    while (await UserModel.findOne({ username })) {
      username = generateRandomUsername(`${firstName} ${lastName}`);
    }

    // Generate a random salt and hash the password
    const salt = random();
    const hashedPassword = authentication(salt, password);

    // Create a new admin user
    const newUser = new UserModel({
      username, // Assign the generated username
      email,
      firstName,
      lastName,
      authentication: {
        password: hashedPassword,
        salt: salt,
      },
      role: "admin", // Assign the 'admin' role
      isVerified: true, // Mark admin as verified by default
    });

    // Save the user to the database
    const savedUser = await newUser.save();

    return res
      .status(201)
      .json({ message: "Admin created successfully", data: savedUser });
  } catch (error) {
    console.error("Error creating admin:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const logout = async (req: express.Request, res: express.Response) => {
  try {
    const user = req.user; // Authenticated user set by the middleware

    if (!user) {
      return res
        .status(500)
        .json({ message: "User data not found in request" });
    }

    // Invalidate the session by clearing sessionToken and sessionExpiry
    user.authentication.sessionToken = "";
    user.authentication.sessionExpiry = null;
    await user.save();

    // Clear the sessionToken cookie from the client's browser
    res.clearCookie("sessionToken", {
      httpOnly: true,
      domain: "localhost", // Adjust if needed
      secure: process.env.NODE_ENV === "production", // Ensure it matches the cookie settings during login
      sameSite: "lax", // Should match the cookie settings during login
      path: "/",
    });

    return res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    console.error("Error during logout:", error);
    return res.status(500).json({ message: "Server error during logout" });
  }
};

export const blockUser = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { userId } = req.params;
    const user = await UserModel.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.status = !user.status;
    await user.save();

    return res.status(200).json({ message: "User blocked successfully" });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteAdmin = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const id = req.params.id;

    // Find the user by email
    const user = await UserModel.findById(id);

    // If user doesn't exist, return 404
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Prevent deletion if the role is 'super admin'
    if (user.role === "superadmin") {
      return res.status(403).json({ message: "Cannot delete a super admin" });
    }

    // Delete the admin if it's not a super admin
    await UserModel.findByIdAndDelete(id);

    return res.status(200).json({ message: "Admin deleted successfully" });
  } catch (err) {
    console.error("Error deleting admin:", err);
    return res.status(500).json({ message: "An error occurred" });
  }
};
