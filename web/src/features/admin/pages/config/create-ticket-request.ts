import type { CreateTicketRequest } from '@/features/admin/lib/api'
import { z } from 'zod'

const positiveIntegerPattern = /^[1-9]\d*$/

export const createTicketFormSchema = z.object({
  username: z.string().trim().min(1),
  target_name: z.string().trim().min(1),
  expiry: z
    .string()
    .refine(value => value === '' || !Number.isNaN(new Date(value).getTime()))
    .optional(),
  number_of_uses: z
    .string()
    .refine(value => value === '' || positiveIntegerPattern.test(value))
    .optional(),
  description: z.string().optional(),
})

export type CreateTicketFormValues = z.infer<typeof createTicketFormSchema>

export function buildCreateTicketRequest(values: CreateTicketFormValues): CreateTicketRequest {
  return {
    username: values.username,
    target_name: values.target_name,
    expiry: values.expiry != null && values.expiry !== '' ? new Date(values.expiry).toISOString() : undefined,
    number_of_uses: values.number_of_uses != null && values.number_of_uses !== ''
      ? Number(values.number_of_uses)
      : undefined,
    description: values.description != null && values.description !== '' ? values.description : undefined,
  }
}
