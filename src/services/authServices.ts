import { ValidationError } from "joi";
import { Google_userInterface, IUser } from "../interfaces/userInterface";
import User from "../models/userModel";
import { passwordCompare, passwordHash } from "../utils/bcrypt";
import CustomError from "../utils/customError";
import { generateAccessToken, generateRefreshToken } from "../utils/jwt";
import {
  generateOTP,
  saveOTP,
  sendOTPEmail,
  verifyOTP,
} from "../utils/otpGenerator";

export const registerUser = async (value: IUser, error?: ValidationError) => {
  if (error) {
    throw new CustomError(error.details[0].message, 400);
  }

  const { firstName, lastName, email, password, dateOfBirth, country, about } =
    value;

  const existingEmail = await User.findOne({ email });
  if (existingEmail) {
    throw new CustomError("email Already registered", 400);
  }

  const hashedPassword = await passwordHash(password);

  const user = await User.create({
    firstName,
    lastName,
    email,
    password: hashedPassword,
    dateOfBirth,
    country,
    about,
  });
  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);
  return { user, accessToken, refreshToken };
};

export const loginUser = async (userData: IUser) => {
  const { email, password } = userData;
  const user = await User.findOne({ email });
  if (!user) throw new CustomError("Invalid Email id", 400);
  const validPassword = await passwordCompare(password, user.password);
  if (!validPassword) throw new CustomError("Invalid Password", 400);
  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  return {
    _id: user._id,
    email: user.email,
    accessToken,
    refreshToken,
  };
};

export const googleRegister = async (googleUser: Google_userInterface) => {
  console.log("google data recieved :", googleUser);
  const email = googleUser.emails?.[0]?.value;
  const userName = googleUser.displayName;
  const profilePicture = googleUser.photos?.[0]?.value || null;

  let user = await User.findOne({ email });

  if (!user) {
    const [firstName, ...rest] = userName.split(" ");
    const lastName = rest.join(" ") || "";

    user = await User.create({
      firstName,
      lastName,
      email,
      profilePicture,
      password: null,
      isGoogleUser: true,
    });
  }

  const accessToken = generateAccessToken(user?._id);

  return accessToken;
};

export const sendOtp = async (email: string) => {
  const userExists = await User.findOne({email})
  if(userExists){
    throw new CustomError('Email already Registered', 400)
  }
  const otp = generateOTP();
  saveOTP(email, otp);
  await sendOTPEmail(email, otp);
};

export const verifyOtpHandler = async ({
  email,
  otp,
}: {
  email: string;
  otp: string;
}) => {
  const result = verifyOTP(email, otp);

  if (result.status === "expired") {
    throw new CustomError("OTP has expired. Please request a new one.", 400);
  }

  if (result.status === "invalid") {
    throw new CustomError(
      "Invalid OTP. Please check the code and try again.",
      400
    );
  }
};
