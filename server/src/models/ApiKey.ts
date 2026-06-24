import mongoose, { Schema, Document, Types } from "mongoose";
import bcrypt from "bcryptjs";

/**
 * ApiKey Model — secure API keys issued to tenants for programmatic access.
 *
 * SECURITY DESIGN:
 * - The raw API key is shown to the tenant ONLY ONCE at creation time.
 * - We store a bcrypt hash of the key. On every request, we hash the
 *   incoming key and compare against stored hashes.
 * - The `prefix` (first 8 chars, e.g. "fck_live_") is stored in plaintext
 *   for identification and quick lookup.
 *
 * Per implementation_plan.md §3.2
 */
export interface IApiKey extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  keyHash: string;
  prefix: string;
  name: string;
  lastUsedAt?: Date;
  expiresAt?: Date;
  isActive: boolean;
  createdAt: Date;
}

const apiKeySchema = new Schema<IApiKey>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    keyHash: {
      type: String,
      required: true,
    },
    prefix: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      default: "Default Key",
      trim: true,
      maxlength: [50, "Key name cannot exceed 50 characters"],
    },
    lastUsedAt: {
      type: Date,
    },
    expiresAt: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform(_doc, ret) {
        // SECURITY: Never expose the hash in API responses
        const obj = ret as any;
        delete obj.keyHash;
        delete obj.__v;
        return obj;
      },
    },
  }
);

/**
 * Static method: Create a new API key for a tenant.
 * Returns the raw key (to show to the user once) and saves the hash.
 */
apiKeySchema.statics.generateKey = async function (
  tenantId: Types.ObjectId,
  name: string = "Default Key"
): Promise<{ rawKey: string; apiKey: IApiKey }> {
  const crypto = await import("crypto");
  const rawSecret = crypto.randomBytes(32).toString("hex");
  const prefix = "fck_live_";
  const rawKey = `${prefix}${rawSecret}`;

  const keyHash = await bcrypt.hash(rawKey, 10);

  const apiKey = await this.create({
    tenantId,
    keyHash,
    prefix,
    name,
  });

  return { rawKey, apiKey };
};

/**
 * Static method: Find and verify an API key.
 * Looks up keys by prefix, then bcrypt-compares the full key.
 */
apiKeySchema.statics.findByRawKey = async function (
  rawKey: string
): Promise<IApiKey | null> {
  // Extract the prefix (everything up to and including "fck_live_")
  const prefix = rawKey.substring(0, 9); // "fck_live_"

  // Find all active keys with this prefix
  const candidates = await this.find({
    prefix,
    isActive: true,
  });

  // Compare the raw key against each candidate's hash
  for (const candidate of candidates) {
    const isMatch = await bcrypt.compare(rawKey, candidate.keyHash);
    if (isMatch) {
      // Update last used timestamp (fire-and-forget)
      candidate.lastUsedAt = new Date();
      candidate.save().catch(() => {}); // Non-blocking
      return candidate;
    }
  }

  return null;
};

// Add static methods to the model interface
export interface IApiKeyModel extends mongoose.Model<IApiKey> {
  generateKey(
    tenantId: Types.ObjectId,
    name?: string
  ): Promise<{ rawKey: string; apiKey: IApiKey }>;
  findByRawKey(rawKey: string): Promise<IApiKey | null>;
}

export const ApiKey = mongoose.model<IApiKey, IApiKeyModel>(
  "ApiKey",
  apiKeySchema
);
