import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";

const router = express.Router();

const USERS_FILE = path.resolve(
  process.cwd(),
  "users.json"
);

function ensureUsersFile() {
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(
      USERS_FILE,
      JSON.stringify([], null, 2),
      "utf8"
    );
  }
}

ensureUsersFile();

function readUsers() {
  try {
    const data = JSON.parse(
      fs.readFileSync(
        USERS_FILE,
        "utf8"
      )
    );

    return Array.isArray(data)
      ? data
      : [];
  } catch {
    return [];
  }
}

function writeUsers(users) {
  fs.writeFileSync(
    USERS_FILE,
    JSON.stringify(
      users,
      null,
      2
    ),
    "utf8"
  );
}

function createId() {
  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function getSecret() {
  const secret =
    process.env.JWT_SECRET;

  if (!secret) {
    throw new Error(
      "JWT_SECRET is missing from .env"
    );
  }

  return secret;
}

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email
    },
    getSecret(),
    {
      expiresIn: "7d"
    }
  );
}

router.post(
  "/register",
  async (req, res) => {
    try {
      const name = String(
        req.body.name || ""
      ).trim();

      const email = String(
        req.body.email || ""
      )
        .trim()
        .toLowerCase();

      const password = String(
        req.body.password || ""
      );

      if (
        !name ||
        !email ||
        !password
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Please complete all fields."
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message:
            "Password must be at least 6 characters."
        });
      }

      const users = readUsers();

      const exists = users.some(
        user =>
          user.email === email
      );

      if (exists) {
        return res.status(400).json({
          success: false,
          message:
            "An account with this email already exists."
        });
      }

      const hashedPassword =
        await bcrypt.hash(
          password,
          10
        );

      const user = {
        id: createId(),
        name,
        email,
        password:
          hashedPassword,
        createdAt:
          new Date().toISOString()
      };

      users.push(user);

      writeUsers(users);

      const token =
        createToken(user);

      return res.json({
        success: true,
        token,

        user: {
          id: user.id,
          name: user.name,
          email: user.email
        }
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Could not create account."
      });
    }
  }
);

router.post(
  "/login",
  async (req, res) => {
    try {
      const email = String(
        req.body.email || ""
      )
        .trim()
        .toLowerCase();

      const password = String(
        req.body.password || ""
      );

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message:
            "Enter your email and password."
        });
      }

      const users = readUsers();

      const user = users.find(
        account =>
          account.email === email
      );

      if (!user) {
        return res.status(401).json({
          success: false,
          message:
            "Incorrect email or password."
        });
      }

      const correct =
        await bcrypt.compare(
          password,
          user.password
        );

      if (!correct) {
        return res.status(401).json({
          success: false,
          message:
            "Incorrect email or password."
        });
      }

      const token =
        createToken(user);

      return res.json({
        success: true,
        token,

        user: {
          id: user.id,
          name: user.name,
          email: user.email
        }
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Could not log in."
      });
    }
  }
);

router.get(
  "/me",
  requireAuth,
  (req, res) => {
    const users = readUsers();

    const user = users.find(
      account =>
        account.id === req.user.id
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message:
          "Account not found."
      });
    }

    return res.json({
      success: true,

      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  }
);

export function requireAuth(
  req,
  res,
  next
) {
  try {
    const authorization =
      req.headers.authorization;

    if (
      !authorization ||
      !authorization.startsWith(
        "Bearer "
      )
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Please log in first."
      });
    }

    const token =
      authorization.substring(7);

    const decoded =
      jwt.verify(
        token,
        getSecret()
      );

    req.user = {
      id: decoded.id,
      email: decoded.email
    };

    next();
  } catch {
    return res.status(401).json({
      success: false,
      message:
        "Your login session has expired."
    });
  }
}

export default router;