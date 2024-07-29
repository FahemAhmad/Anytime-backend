import nodemailer from "nodemailer";

// Create a Nodemailer transporter
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com", // Your SMTP host
  port: 587, // Your SMTP port
  secure: false, // true for 465, false for other ports
  auth: {
    user: "faheemahmad0108@gmail.com", // Your email address
    pass: "dunoxtnidkbtmceh", // Your email password
  },
});

// Email options interface
interface EmailOptions {
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

// Function to send email
export const sendEmail = async (options: EmailOptions): Promise<void> => {
  try {
    // Send mail with defined transport object
    await transporter.sendMail(options);

    console.log("Email sent successfully.");
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};

export const sendOTP = async (email: string, otp: string): Promise<void> => {
  try {
    // Email options
    const emailOptions = {
      from: "faheemahmad0108@gmail.com", // Sender address (change to your Gmail address)
      to: email,
      subject: "OTP Verification", // Subject line
      text: `Your OTP for registration is: ${otp}`, // Plain text body
    };

    // Send email
    await sendEmail(emailOptions);

    console.log("OTP email sent successfully.");
  } catch (error) {
    console.error("Error sending OTP email:", error);
    throw error;
  }
};

// In your emailService.ts file

export const sendFeedbackEmail = async (
  type: string,
  message: string,
  source: any
): Promise<void> => {
  try {
    let subject: string;
    switch (type.toLowerCase()) {
      case "feedback":
        subject = "User Feedback";
        break;
      case "help center":
        subject = "Help Center Request";
        break;
      case "report a problem":
        subject = "Problem Report";
        break;
      default:
        subject = "User Message";
    }

    // Create a string with the source information
    const sourceInfo = Object.entries(source)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");

    // Email options
    const emailOptions = {
      from: "faheemahmad0108@gmail.com", // Sender address (change to your Gmail address)
      to: "faheemahmad0108@gmail.com", // Change this to your support email
      subject: subject,
      text: `Type: ${type}\n\nMessage: ${message}\n\nSource Information:\n${sourceInfo}`,
    };

    // Send email
    await sendEmail(emailOptions);
    console.log("Feedback email sent successfully.");
  } catch (error) {
    console.error("Error sending feedback email:", error);
    throw error;
  }
};
