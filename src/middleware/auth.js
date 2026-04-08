import { supabase } from "../config/supabase.js";

export const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token" });
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return res.status(401).json({ error: "Invalid token" });
  }

  const userId = data.user.id;

  // 🔥 FETCH ROLE FROM PROFILES TABLE
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    return res.status(401).json({ error: "User profile not found" });
  }

  req.user = {
    id: userId,
    role: profile.role,
    email: data.user.email
  };

  console.log("USER:", req.user);

  next();
};
