import { supabase } from "../config/supabase.js";

export const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token" });
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    req.user = {
      id: data.user.id
    };

    next();
  } catch (err) {
    return res.status(401).json({ error: "Auth failed" });
  }
};