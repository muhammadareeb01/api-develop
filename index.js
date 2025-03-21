
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Initialize Supabase
const supabase = createClient(
  "https://yhyaslxqzwqptknmybqa.supabase.co",'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InloeWFzbHhxendxcHRrbm15YnFhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczOTM0MjQ3MSwiZXhwIjoyMDU0OTE4NDcxfQ.MrVagZRK4IM5XsefxgOYc93LMXxX81qe94mFETkuRNs');
const resend = new Resend("re_epCkTUjB_8VatRdLBoWDFKDU16uqYkz7g");
app.use(cors({
  origin: "https://joinprox.com",
  methods: ["POST"],
}));
app.use(express.json());

// Function to generate secure passwords
function generatePassword() {
  return crypto.randomBytes(12).toString("base64").slice(0, 16) + "!@#";
}

// Waitlist API
app.post("/api/waitlist", async (req, res) => {
  try {
    const { email, name, zip_code, preferred_retailers, device_preference, feedback } = req.body;
    console.log("Received waitlist signup request for:", email);

    // Validate required fields
    if (!email || !name || !zip_code) {
      return res.status(400).json({ error: "Name, email, and ZIP code are required" });
    }
    if (!Array.isArray(preferred_retailers) || preferred_retailers.length === 0) {
      return res.status(400).json({ error: "Please select at least one preferred retailer" });
    }
    if (!device_preference) {
      return res.status(400).json({ error: "Please select a device preference" });
    }

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: generatePassword(),
      email_confirm: false, 
    });

    if (authError) {
      if (authError.message.includes("already registered")) {
        console.log("Email already registered:", email);
        return res.status(400).json({ error: "Email already registered" });
      }
      throw authError;
    }

    // Generate email confirmation link
    const { data: confirmData, error: confirmError } = await supabase.auth.admin.generateLink({
      type: "signup",
      email: email,
    });

    if (confirmError) {
      throw confirmError;
    }

    const confirmationLink = confirmData.action_link;

    // Insert into waitlist
    const { error: insertError } = await supabase
      .from("waitlist")
      .insert([
        {
          email,
          name,
          zip_code,
          preferred_retailers,
          device_preference,
          feedback: feedback || "No feedback provided",
          user_id: authData?.user?.id,
          // status: "pending",
          metadata: {
            signup_source: "website",
            signup_date: new Date().toISOString(),
            provider: "resend",
          },
        },
      ]);

    if (insertError) throw insertError;

    // Send email confirmation via Resend
    await resend.emails.send({
        from: `"Alston" <alston@joinprox.com>`,
      to: email,
      subject: "Confirm Your Email - Prox",
      html: `
        <div style="font-family: Helvetica, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #082517;">Confirm Your Email</h1>
          <p>Hello ${name},</p>
          <p>Click the button below to verify your email:</p>
          <a href="${confirmationLink}" style="background: #007BFF; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Confirm Email
          </a>
          <p>If you didn't sign up, please ignore this email.</p>
          <p>Best, <br>The Prox Team</p>
        </div>
      `,
    });

    console.log("Confirmation email sent to:", email);

    res.json({ message: "Successfully joined waitlist. Email confirmation sent.", userId: authData?.user?.id });

  } catch (error) {
    console.error("Error in waitlist:", {
      message: error.message,
      stack: error.stack,
      details: error,
    });
    res.status(500).json({ error: error.message || "Failed to join waitlist" });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});






app.get("/", (req, res) => {
  res.send("API is running successfully 🚀");
});
