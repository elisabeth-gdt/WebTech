/**
 * Auth routes
 *
 * POST /auth/google          – Exchange Google ID token for app JWT
 * POST /auth/passkey/register/options   – Start passkey registration
 * POST /auth/passkey/register/verify    – Finish passkey registration
 * POST /auth/passkey/login/options      – Start passkey authentication
 * POST /auth/passkey/login/verify       – Finish passkey authentication
 * POST /auth/logout          – Invalidate client token (stateless: client drops JWT)
 * GET  /auth/me              – Return current user profile
 */

const express = require("express");
const router = express.Router();
const { OAuth2Client } = require("google-auth-library");
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require("@simplewebauthn/server");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { requireAuth, JWT_SECRET } = require("../middleware/auth");

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const RP_NAME = process.env.RP_NAME || "TodoApp";
const RP_ID = process.env.RP_ID || "localhost";
const ORIGIN = process.env.ORIGIN || "http://localhost:5173";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// ── Helper ────────────────────────────────────────────────────────────────────

function signToken(user) {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
      displayName: user.displayName,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );
}

// ── Google OIDC ───────────────────────────────────────────────────────────────

/**
 * POST /auth/google
 * Body: { idToken: string }
 * Verifies Google's ID token, creates/updates local user, returns app JWT.
 */
router.post("/google", async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: "idToken required" });

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    let user = await User.findOne({ googleId: payload.sub });
    if (!user) {
      // Also check by email — user may have registered via passkey first
      user = await User.findOne({ email: payload.email });
      if (user) {
        user.googleId = payload.sub;
      } else {
        user = new User({
          email: payload.email,
          displayName: payload.name,
          avatarUrl: payload.picture,
          googleId: payload.sub,
        });
      }
      await user.save();
    }

    res.json({ token: signToken(user), user: user.toPublicJSON() });
  } catch (err) {
    console.error("[auth/google]", err);
    res.status(401).json({ error: "Google token verification failed" });
  }
});

// ── Passkey – Registration ────────────────────────────────────────────────────

/**
 * POST /auth/passkey/register/options
 * Body: { email: string, displayName?: string }
 * Returns WebAuthn registration options and stores challenge on the user document.
 */
router.post("/passkey/register/options", async (req, res) => {
  try {
    const { email, displayName } = req.body;
    if (!email) return res.status(400).json({ error: "email required" });

    let user = await User.findOne({ email });
    if (!user) {
      user = new User({ email, displayName: displayName || email });
    }

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: Buffer.from(user._id.toString()),
      userName: email,
      userDisplayName: user.displayName || email,
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
      excludeCredentials: user.passkeys.map((pk) => ({
        id: pk.credentialID,
        transports: pk.transports,
      })),
    });

    user.currentChallenge = options.challenge;
    await user.save();

    res.json(options);
  } catch (err) {
    console.error("[passkey/register/options]", err);
    res.status(500).json({ error: "Could not generate registration options" });
  }
});

/**
 * POST /auth/passkey/register/verify
 * Body: { email: string, registrationResponse: PublicKeyCredential }
 * Verifies the credential, stores public key, returns app JWT.
 */
router.post("/passkey/register/verify", async (req, res) => {
  try {
    const { email, registrationResponse } = req.body;
    if (!email || !registrationResponse) {
      return res
        .status(400)
        .json({ error: "email and registrationResponse required" });
    }

    const user = await User.findOne({ email });
    if (!user || !user.currentChallenge) {
      return res
        .status(400)
        .json({ error: "No pending registration for this email" });
    }

    const verification = await verifyRegistrationResponse({
      response: registrationResponse,
      expectedChallenge: user.currentChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    });

    if (!verification.verified) {
      return res.status(400).json({ error: "Passkey verification failed" });
    }

    const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;
    user.passkeys.push({
      credentialID:        credentialID,
      credentialPublicKey: Buffer.from(credentialPublicKey).toString("base64url"),
      counter:             counter,
      transports:          registrationResponse.response?.transports || [],
    });
    user.currentChallenge = null;
    await user.save();

    res.json({ token: signToken(user), user: user.toPublicJSON() });
  } catch (err) {
    console.error("[passkey/register/verify]", err);
    res.status(500).json({ error: "Registration verification error" });
  }
});

// ── Passkey – Authentication ──────────────────────────────────────────────────

/**
 * POST /auth/passkey/login/options
 * Body: { email: string }
 * Returns WebAuthn authentication options.
 */
router.post("/passkey/login/options", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "email required" });

    const user = await User.findOne({ email });
    if (!user || user.passkeys.length === 0) {
      return res
        .status(404)
        .json({ error: "No passkeys registered for this email" });
    }

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      userVerification: "preferred",
      allowCredentials: user.passkeys.map((pk) => ({
        id: pk.credentialID,
        transports: pk.transports,
      })),
    });

    user.currentChallenge = options.challenge;
    await user.save();

    res.json(options);
  } catch (err) {
    console.error("[passkey/login/options]", err);
    res
      .status(500)
      .json({ error: "Could not generate authentication options" });
  }
});

/**
 * POST /auth/passkey/login/verify
 * Body: { email: string, authenticationResponse: PublicKeyCredential }
 * Verifies the assertion, returns app JWT.
 */
router.post("/passkey/login/verify", async (req, res) => {
  try {
    const { email, authenticationResponse } = req.body;
    if (!email || !authenticationResponse) {
      return res
        .status(400)
        .json({ error: "email and authenticationResponse required" });
    }

    const user = await User.findOne({ email });
    if (!user || !user.currentChallenge) {
      return res
        .status(400)
        .json({ error: "No pending authentication for this email" });
    }

    const passkey = user.passkeys.find(
      (pk) => pk.credentialID === authenticationResponse.id,
    );
    if (!passkey) {
      return res.status(400).json({ error: "Unknown credential" });
    }

    const verification = await verifyAuthenticationResponse({
      response: authenticationResponse,
      expectedChallenge: user.currentChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      authenticator: {
        credentialID: passkey.credentialID,
        credentialPublicKey: Buffer.from(passkey.credentialPublicKey, "base64url"),
        counter: passkey.counter,
        transports: passkey.transports,
      },
    });

    if (!verification.verified) {
      return res.status(401).json({ error: "Authentication failed" });
    }

    // Update counter (replay-attack protection)
    passkey.counter = verification.authenticationInfo.newCounter;
    user.currentChallenge = null;
    await user.save();

    res.json({ token: signToken(user), user: user.toPublicJSON() });
  } catch (err) {
    console.error("[passkey/login/verify]", err);
    res.status(500).json({ error: "Authentication verification error" });
  }
});

// ── Session / Profile ─────────────────────────────────────────────────────────

/**
 * POST /auth/logout
 * Stateless JWT: the client simply discards the token.
 * This endpoint exists for symmetry and potential future token blocklisting.
 */
router.post("/logout", (req, res) => {
  res.json({ message: "Logged out. Please discard your token." });
});

/**
 * GET /auth/me
 * Returns the currently authenticated user's public profile.
 */
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user.toPublicJSON());
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
