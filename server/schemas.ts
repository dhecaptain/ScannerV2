import { z } from 'zod';

export const CustomFieldRequestSchema = z.object({
  name: z.string().min(1, 'Field name cannot be empty').max(60, 'Field name cannot exceed 60 characters'),
  description: z.string().max(300, 'Description cannot exceed 300 characters').optional(),
  type: z.enum(['string', 'number', 'boolean']).default('string'),
});

export const ExtractRequestBodySchema = z.object({
  image: z.string().min(10, 'Image base64 data is required').max(5_500_000, 'Payload image is too large'),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp'] as const),
  model: z.enum(['gemini-2.5-flash', 'gemini-2.5-pro'] as const).default('gemini-2.5-flash'),
  customFields: z.array(CustomFieldRequestSchema).max(20, 'Maximum 20 custom fields allowed').optional(),
  askPrompt: z.string().max(500, 'askPrompt cannot exceed 500 characters').optional(),
  documentType: z.enum(['receipt', 'invoice', 'price_list', 'table', 'auto'] as const).default('receipt'),
});

export type ExtractRequestBody = z.infer<typeof ExtractRequestBodySchema>;
