export const Config = {
  ENABLE_MAIL_CONFIRMATION: false, // Requires users to confirm registrations via email, remember to also change the default value of new users in the schema.prisma file
  SESSION_EXPIRES_MS: 604800000, // Session expires at duration, default: a week

  /* Argon2id configuration */
  ARGON2ID: {
    timeCost: 3, // Number of iterations, default: 3
    memoryCost: 65536, // Memory cost in KB, default: 64 MiB
    parallelism: 1, // Number of threads, default: 1
  },
};
