import db, { uuid } from "../lib/db.js";
import argon2 from "argon2";
import jwt from "jsonwebtoken";

export const register = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        message: "Username and password are required"
      });
    }

    const exists = db.prepare('SELECT * FROM User WHERE username = ?').get(username);

    if (exists) {
      return res.status(400).json({
        message: "User already exists"
      });
    }

    const hashedPassword = await argon2.hash(password);

    const id = uuid();
    db.prepare('INSERT INTO User (id, username, password) VALUES (?, ?, ?)').run(id, username, hashedPassword);
    const user = db.prepare('SELECT * FROM User WHERE id = ?').get(id);

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d"
      }
    );

    return res.status(201).json({
      message: "Registered successfully",
      username: user.username,
      token
    });
  } catch (error) {
    console.error("Register error:", error);

    return res.status(500).json({
      message: "Internal server error"
    });
  }
};

export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        message: "Username and password are required"
      });
    }

    const user = db.prepare('SELECT * FROM User WHERE username = ?').get(username);

    if (!user) {
      return res.status(401).json({
        message: "Invalid credentials"
      });
    }

    const validPassword = await argon2.verify(
      user.password,
      password
    );

    if (!validPassword) {
      return res.status(401).json({
        message: "Invalid credentials"
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d"
      }
    );

    return res.json({
      message: "Login successful",
      username: user.username,
      token
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      message: "Internal server error"
    });
  }
};

export const deleteAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    
    db.prepare('DELETE FROM User WHERE id = ?').run(userId);
    
    return res.json({
      message: "Account deleted successfully"
    });
  } catch (error) {
    console.error("Delete account error:", error);
    return res.status(500).json({
      message: "Internal server error"
    });
  }
};
