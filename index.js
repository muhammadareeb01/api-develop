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
  "https://yhyaslxqzwqptknmybqa.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InloeWFzbHhxendxcHRrbm15YnFhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczOTM0MjQ3MSwiZXhwIjoyMDU0OTE4NDcxfQ.MrVagZRK4IM5XsefxgOYc93LMXxX81qe94mFETkuRNs"
);
const resend = new Resend("re_epCkTUjB_8VatRdLBoWDFKDU16uqYkz7g");
app.use(
  cors({
    origin: "https://joinprox.com",
    methods: ["POST"],
  })
);
app.use(express.json());

// Function to generate secure passwords
function generatePassword() {
  return crypto.randomBytes(12).toString("base64").slice(0, 16) + "!@#";
}

// Waitlist API
app.post("/api/waitlist", async (req, res) => {
  try {
    const {
      email,
      name,
      zip_code,
      preferred_retailers,
      device_preference,
      feedback,
    } = req.body;
    console.log("Received waitlist signup request for:", email);

    // Validate required fields
    if (!email || !name || !zip_code) {
      return res
        .status(400)
        .json({ error: "Name, email, and ZIP code are required" });
    }
    if (
      !Array.isArray(preferred_retailers) ||
      preferred_retailers.length === 0
    ) {
      return res
        .status(400)
        .json({ error: "Please select at least one preferred retailer" });
    }
    if (!device_preference) {
      return res
        .status(400)
        .json({ error: "Please select a device preference" });
    }

    // Create user in Supabase Auth
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
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
    const { data: confirmData, error: confirmError } =
      await supabase.auth.admin.generateLink({
        type: "signup",
        email: email,
      });

    if (confirmError) {
      throw confirmError;
    }

    const confirmationLink = confirmData.action_link;

    // Insert into waitlist
    const { error: insertError } = await supabase.from("waitlist").insert([
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
      subject: "Welcome to the Prox Community",
      html: `
        <html>
        <head>
          <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
          <style>
            body {
              font-family: 'Roboto', Arial, sans-serif;
              background-color: #FFFFFF;
              margin: 0;
              padding: 0;
            }
            .container {
              max-width: 600px;
              margin: 30px auto;
              background-color: #082517;
              color: #FFFFFF;
              padding: 40px;
              border-radius: 12px;
            }
            h2, h3 {
              color: #60FF6F;
            }
            h2 {
              font-size: 28px;
              font-weight: 700;
            }
            h3 {
              font-size: 22px;
              margin-top: 40px;
              font-weight: 500;
            }
            p {
              font-size: 16px;
              line-height: 1.6;
              font-weight: 400;
            }
            ul {
              margin-top: 10px;
              margin-bottom: 20px;
            }
            li {
              margin-bottom: 8px;
            }
            a.button {
              display: inline-block;
              margin-top: 20px;
              padding: 12px 24px;
              background-color: #60FF6F;
              color: #082517;
              text-decoration: none;
              font-weight: 700;
              border-radius: 8px;
            }
            .footer-wrapper {
              margin: 40px -40px -40px -40px;
              background-color: #F0F0F0;
              padding: 20px;
              border-radius: 0 0 12px 12px;
            }
            .footer {
              text-align: center;
              font-size: 12px;
              color: #666666;
            }
            .footer a {
              color: #666666;
              text-decoration: underline;
            }
          </style>
        </head>
        <body>
    
          <div class="container">
            <p>Hi ${name},</p>
            <h2>Welcome to Prox 👋</h2>
            <p>We're thrilled to have you join us on this journey to make grocery shopping smarter, easier, and more affordable.</p>
            
            <p>As part of the Prox community, you'll get:</p>
            <ul>
              <li>🔎 Real-time price comparisons across stores near you</li>
              <li>💡 Data-driven insights to help you save more</li>
              <li>📊 Early access to exclusive features and tools</li>
              <li>📚 Access to weekly blog posts on how to strategically find savings</li>
            </ul>
    
            <p>To get started, please confirm your email by clicking the button below:</p>
    
            <a href="${confirmationLink}" class="button">Confirm Your Email</a>
    
            <h3>As an added bonus for joining the waitlist:</h3>
            <p>🎉 You now have <strong>unlimited free access</strong> to our services while we’re in beta!</p>
    
            <p>We'll personally review your grocery list and get back to you with <strong>15%+ savings</strong> in less than <strong>24 hours</strong>. Just reply directly to this email with:</p>
            <ul>
              <li>Your zip code</li>
              <li>Your grocery list (in any format)
                <ul>
                  <li>A recent receipt</li>
                  <li>A screenshot of your online shopping cart</li>
                  <li>A hand-written grocery list</li>
                  <li>OR even an ancient scroll with hieroglyphics</li>
                </ul>
              </li>
            </ul>
    
            <p>Thanks again for joining Prox. We're so excited to have you with us!</p>
    
            <div class="footer-wrapper">
              <div class="footer">
                <p>© 2025 Prox, LLC</p>
                <p>2903 Lincoln Blvd, Santa Monica, CA 90405</p>
                <p><a href="\${unsubscribeURL}">Update your email preferences or unsubscribe here</a></p>
              </div>
            </div>
    
          </div>
    
        </body>
        </html>
      `,
    });

    console.log("Confirmation email sent to:", email);

    res.json({
      message: "Successfully joined waitlist. Email confirmation sent.",
      userId: authData?.user?.id,
    });
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
