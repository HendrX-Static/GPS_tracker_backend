import { supabase } from "../config/supabase.js";

export const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token" });
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(token.split(".")[1], "base64").toString()
    );

    // fetch role from DB
    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", decoded.sub)
      .single();

    if (error) throw error;

    req.user = {
      id: decoded.sub,
      role: data.role
    };

    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
};