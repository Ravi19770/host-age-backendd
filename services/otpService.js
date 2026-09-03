const otpGenerator = require("otp-generator");



const generateOTP = (email) => {
  const otp = otpGenerator.generate(6, {
    upperCaseAlphabets: false,
    lowerCaseAlphabets: false,
    specialChars: false,
  });

  otpStore.set(email, otp);

  return otp;
};

const verifyOTP = (email, otp) => {
  return otpStore.get(email) === otp;
};

module.exports = {
  generateOTP,
  verifyOTP,
};