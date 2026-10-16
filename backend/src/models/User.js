import mongoose from 'mongoose';

export const USER_ROLES = Object.freeze(['user', 'admin']);

// Pragmatic shape check; the API validates more strictly (Zod) before writes.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: 1,
      maxlength: 100,
    },
    // Stored normalized (trimmed, lowercase) so the unique index is case-insensitive.
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      maxlength: 254,
      match: [EMAIL_PATTERN, 'Email is invalid'],
    },
    // bcrypt hash; excluded from queries unless explicitly selected.
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: USER_ROLES,
      default: 'user',
    },
    // Embedded in each session token; incrementing it revokes every outstanding token.
    tokenVersion: {
      type: Number,
      default: 0,
      select: false,
    },
    lastLoginAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    strict: 'throw',
  }
);

userSchema.index({ email: 1 }, { unique: true });

/** The only representation of a user that may leave the API. */
userSchema.methods.toSafeProfile = function toSafeProfile() {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    role: this.role,
    createdAt: this.createdAt,
    lastLoginAt: this.lastLoginAt ?? null,
  };
};

// Defense in depth: even an accidental res.json(user) cannot leak secrets.
userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.tokenVersion;
    delete ret.__v;
    ret.id = ret._id?.toString();
    delete ret._id;
    return ret;
  },
});

export const User = mongoose.models.User ?? mongoose.model('User', userSchema);
