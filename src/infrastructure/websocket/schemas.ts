import { z } from 'zod';

export const joinLobbySchema = z.object({
  nickname: z
    .string({ error: 'Nickname is required' })
    .trim()
    .min(1, 'Nickname must be at least 1 character')
    .max(20, 'Nickname cannot exceed 20 characters'),
});

export const switchPokemonSchema = z.object({
  targetPokemonIndex: z
    .number({ error: 'Target pokemon index is required' })
    .int('Index must be an integer')
    .min(0, 'Index cannot be negative')
    .max(2, 'Index cannot exceed 2'),
});
