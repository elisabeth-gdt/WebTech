const mongoose = require('mongoose');

/**
 * Passkey credential stored per user.
 * One user can have multiple passkeys (e.g. phone + laptop).
 */
const PasskeySchema = new mongoose.Schema({
  credentialID:        { type: String, required: true },   // base64url
  credentialPublicKey: { type: String, required: true },   // base64url (CBOR-encoded)
  counter:             { type: Number, required: true, default: 0 },
  transports:          { type: [String], default: [] },    // 'internal' | 'usb' | ...
  createdAt:           { type: Date, default: Date.now },
});

const UserSchema = new mongoose.Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    email:       { type: String, required: true, unique: true, lowercase: true, trim: true },
    displayName: { type: String, default: '' },
    avatarUrl:   { type: String, default: '' },

    // ── Role ─────────────────────────────────────────────────────────────────
    role: {
      type:    String,
      enum:    ['user', 'moderator', 'admin'],
      default: 'user',
    },

    // ── Google / OpenID Connect ───────────────────────────────────────────────
    googleId: { type: String, sparse: true, default: null },

    // ── Passkeys (WebAuthn) ───────────────────────────────────────────────────
    passkeys:             { type: [PasskeySchema], default: [] },
    // Temporary challenge stored during registration / authentication ceremony
    currentChallenge:     { type: String, default: null },
  },
  { timestamps: true }
);

// Convenience: never leak internal fields to API consumers
UserSchema.methods.toPublicJSON = function () {
  return {
    id:          this._id,
    email:       this.email,
    displayName: this.displayName,
    avatarUrl:   this.avatarUrl,
    role:        this.role,
  };
};

module.exports = mongoose.model('User', UserSchema);