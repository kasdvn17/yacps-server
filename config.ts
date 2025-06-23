export const Config = {
  ENABLE_USER_SELF_REGISTRATIONS: true, // Allow users to self-register, otherwise, admins must manually create users, default: true
  ENABLE_MAIL_CONFIRMATION: false, // Requires users to confirm registrations via email, default: false
  ENABLE_CAPTCHA: false, // Require users to complete hCaptcha when creating users, sessions - default: true
  SESSION_EXPIRES_MS: 604800000, // Session expires at duration, default: a week

  /* Argon2id configuration */
  ARGON2ID: {
    timeCost: 3, // Number of iterations, default: 3
    memoryCost: 65536, // Memory cost in KB, default: 64 MiB
    parallelism: 1, // Number of threads, default: 1
  },
};
