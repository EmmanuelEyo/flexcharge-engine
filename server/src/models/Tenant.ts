import mongoose, { Schema, Document, Types } from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { generateSecureToken } from "../utils/hmac.js";

/**
 * Tenant Model — represents a downstream business team using FlexCharge.
 *
 * Each tenant has:
 * - Credentials for logging into the FlexCharge dashboard (email + password)
 * - A webhookUrl where we deliver subscription events
 * - A webhookSecret used to HMAC-sign outgoing webhook payloads
 *
 * Per implementation_plan.md §3.1
 */
export interface ITenant extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  webhookUrl?: string;
  webhookSecret: string;
  isActive: boolean;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  generatePasswordReset(): string;
}

const tenantSchema = new Schema<ITenant>(
  {
    name: {
      type: String,
      required: [true, "Tenant name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    webhookUrl: {
      type: String,
      trim: true,
    },
    webhookSecret: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    resetPasswordToken: {
      type: String,
    },
    resetPasswordExpires: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        // SECURITY: Never expose passwordHash or webhookSecret in API responses
        const obj = ret as any;
        delete obj.passwordHash;
        delete obj.webhookSecret;
        delete obj.resetPasswordToken;
        delete obj.resetPasswordExpires;
        delete obj.__v;
        return obj;
      },
    },
  }
);

/**
 * Pre-save hook: Hash password before storing.
 * Only runs when the password field has been modified.
 */
tenantSchema.pre("save", async function () {
  if (!this.isModified("passwordHash")) return;
  this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
});

/**
 * Instance method: Compare a candidate password against the stored hash.
 */
tenantSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

/**
 * Static: Generate a webhook secret for new tenants.
 * Called during registration.
 */
tenantSchema.pre("validate", function () {
  if (this.isNew && !this.webhookSecret) {
    this.webhookSecret = generateSecureToken(32);
  }
});

/**
 * Instance method: Generate a password reset token.
 * Saves the SHA-256 hash in the database and returns the raw token.
 */
tenantSchema.methods.generatePasswordReset = function (): string {
  // Generate a raw 32-byte hex token
  const resetToken = crypto.randomBytes(32).toString("hex");

  // Hash the token for storage
  this.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  // Set expiration to 1 hour (3600000 ms)
  this.resetPasswordExpires = new Date(Date.now() + 3600000);

  return resetToken;
};

export const Tenant = mongoose.model<ITenant>("Tenant", tenantSchema);

