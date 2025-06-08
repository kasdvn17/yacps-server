export const Config = {
  ENABLE_MAIL_CONFIRMATION: false, // Requires users to confirm registrations via email, remember to also change the default value of new users in the schema.prisma file
  SESSION_EXPIRES_MS: 604800000, // Session expires at duration, default: a week
};
