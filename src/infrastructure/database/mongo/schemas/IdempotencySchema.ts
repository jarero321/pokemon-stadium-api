import mongoose, { Schema } from 'mongoose';

const idempotencySchema = new Schema(
  {
    requestId: { type: String, required: true, unique: true },
    result: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

idempotencySchema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 });

export const IdempotencyModel = mongoose.model(
  'Idempotency',
  idempotencySchema,
);
