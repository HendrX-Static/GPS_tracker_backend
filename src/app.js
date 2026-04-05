import "dotenv/config";
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import routes from "./routes/index.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api", routes);

app.get("/", (req, res) => {
  res.send("GPS Backend Running 🚀");
});

app.listen(5001, () => {
  console.log("Server running on port 5001");
});