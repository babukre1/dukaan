import { z } from 'zod'

export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_POLICY_MESSAGE = 'Password must be at least 8 characters and include a letter and a number'

export const strongPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, PASSWORD_POLICY_MESSAGE)
  .max(200)
  .regex(/[A-Za-z]/, PASSWORD_POLICY_MESSAGE)
  .regex(/\d/, PASSWORD_POLICY_MESSAGE)
