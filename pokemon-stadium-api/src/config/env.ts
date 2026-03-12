import { z } from 'zod/v4';

const envSchema = z.object({
  PORT: z.coerce.number().default(8080),
  HOST: z.string().default('0.0.0.0'),
  MONGODB_URI: z.url({
    message: 'MONGODB_URI must be a valid connection string',
  }),
  POKEMON_API_BASE_URL: z.url({
    message: 'POKEMON_API_BASE_URL must be a valid URL',
  }),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
});

type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const title = '  Missing or invalid environment vars';
    const hint = '  → Copy .env.example to .env';

    const lines = result.error.issues.map((issue) => {
      const field = issue.path.join('.');
      return `  ✗ ${field}: ${issue.message}`;
    });

    const allLines = [title, ...lines, hint];
    const WIDTH = Math.max(...allLines.map((l) => l.length)) + 4;
    const border = '═'.repeat(WIDTH - 2);
    const pad = (text: string) => {
      const remaining = WIDTH - 2 - text.length;
      return `║${text}${' '.repeat(Math.max(0, remaining))}║`;
    };

    console.error(`\n╔${border}╗`);
    console.error(pad(title));
    console.error(`╠${border}╣`);
    lines.forEach((line) => console.error(pad(line)));
    console.error(`╠${border}╣`);
    console.error(pad(hint));
    console.error(`╚${border}╝\n`);

    process.exit(1);
  }

  return result.data;
}

export const env = validateEnv();
