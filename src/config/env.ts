import { z } from 'zod/v4';

const envSchema = z.object({
  PORT: z.coerce.number().default(8080),
  HOST: z.string().default('0.0.0.0'),
  MONGODB_URI: z.url({ message: 'MONGODB_URI must be a valid connection string' }),
  POKEMON_API_BASE_URL: z.url({ message: 'POKEMON_API_BASE_URL must be a valid URL' }),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues.map((issue) => {
      const field = issue.path.join('.');
      return `  ✗ ${field}: ${issue.message}`;
    });

    console.error('\n╔══════════════════════════════════════════╗');
    console.error('║   Missing or invalid environment vars    ║');
    console.error('╠══════════════════════════════════════════╣');
    console.error(errors.join('\n'));
    console.error('╚══════════════════════════════════════════╝');
    console.error('\n→ Copy .env.example to .env and fill in the values\n');

    process.exit(1);
  }

  return result.data;
}

export const env = validateEnv();
