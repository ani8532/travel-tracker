// Import required modules
import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import pkg from "pg";

// Load environment variables
dotenv.config();

const { Pool } = pkg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // ✅ Fetch from environment
  ssl: {
    rejectUnauthorized: false, // ✅ Required for Render PostgreSQL
  },
});

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");

let currentUserId = 1;
let users = [];

async function checkVisited() {
  const result = await pool.query(
    "SELECT country_code FROM visited_countries WHERE user_id = $1;",
    [currentUserId]
  );
  return result.rows.map((row) => row.country_code);
}

async function getCurrentUser() {
  const result = await pool.query("SELECT * FROM users WHERE id = $1", [currentUserId]);
  return result.rows[0];
}

app.get("/", async (req, res) => {
  try {
    const countries = await checkVisited();
    const currentUser = await getCurrentUser();
    const usersResult = await pool.query("SELECT * FROM users");
    users = usersResult.rows;
    
    res.render("index", {
      countries,
      total: countries.length,
      users,
      color: currentUser?.color || "white",
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/add", async (req, res) => {
  try {
    const input = req.body["country"];
    const result = await pool.query(
      "SELECT country_code FROM countries WHERE LOWER(country_name) LIKE '%' || $1 || '%' LIMIT 1;",
      [input.toLowerCase()]
    );
    
    if (result.rows.length > 0) {
      await pool.query(
        "INSERT INTO visited_countries (country_code, user_id) VALUES ($1, $2)",
        [result.rows[0].country_code, currentUserId]
      );
    }
  } catch (err) {
    console.error(err);
  }
  res.redirect("/");
});

app.post("/user", async (req, res) => {
  if (req.body.add === "new") {
    res.render("new");
  } else {
    currentUserId = parseInt(req.body.user, 10);
    res.redirect("/");
  }
});

app.post("/new", async (req, res) => {
  try {
    const { name, color } = req.body;
    const result = await pool.query(
      "INSERT INTO users (name, color) VALUES($1, $2) RETURNING id;",
      [name, color]
    );
    currentUserId = result.rows[0].id;
  } catch (error) {
    console.error(error);
  }
  res.redirect("/");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
