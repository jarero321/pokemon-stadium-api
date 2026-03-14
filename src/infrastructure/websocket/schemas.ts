import { z } from 'zod';

export const attackSchema = z.object({
  requestId: z.string().uuid(),
});

export const switchPokemonSchema = z.object({
  requestId: z.string().uuid(),
  targetPokemonIndex: z
    .number({ error: 'Target pokemon index is required' })
    .int('Index must be an integer')
    .min(0, 'Index cannot be negative')
    .max(2, 'Index cannot exceed 2'),
});
