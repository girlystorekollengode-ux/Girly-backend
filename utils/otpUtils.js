import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export function generateOTP() {
  const otpVal = crypto.randomInt(100000, 999999).toString();
  return otpVal.padStart(6, '0');
}

export async function hashOTP(otp) {
  return await bcrypt.hash(otp, 10);
}

export async function verifyOTP(enteredOTP, hashedOTP) {
  return await bcrypt.compare(enteredOTP, hashedOTP);
}
